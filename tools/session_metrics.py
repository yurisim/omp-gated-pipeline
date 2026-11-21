"""Summarize gated pipeline runs from omp JSONL session transcripts."""

import argparse
import json
import re
import sys
from collections.abc import Iterator
from pathlib import Path
from typing import BinaryIO

ROLES = ("main", "synth", "reviewer", "advisor", "other")
REVIEW_VARIANTS = {"adversarial-reviewer": "slow", "adversarial-reviewer-alt": "alt"}
EDIT_PATH = re.compile(r"^\[(.+)#[0-9A-Fa-f]{4}\]\s*$")
SHELL_WRITE = re.compile(r"""cat\s*>|<<\s*['"]?EOF|open\([^)]*['"][wa]b?['"]|\.write_text\(|\btee\b""")
REVIEW_FINDING = re.compile(r"^- (CRIT|WARN)")


def _records(source: BinaryIO) -> Iterator[dict]:
    for line in source:
        try:
            record = json.loads(line)
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue
        if isinstance(record, dict):
            yield record


def _usage(message: dict) -> tuple[float, int]:
    usage = message.get("usage") or {}
    return (usage.get("cost") or {}).get("total", 0), usage.get("output", 0)


def _calls(message: dict) -> Iterator[dict]:
    for item in message.get("content", []):
        if item.get("type") == "toolCall":
            yield item


def _path_kind(path: str) -> str | None:
    path = path.replace("\\", "/")
    if path.startswith(("agent://", "proc://", "out://", "xd://")):
        return None
    if path.startswith("local://") or "/.omp/" in path:
        return "plan"
    if "/.scratch/" in path or path.startswith(".scratch/") or "/tmp/" in path.lower():
        return "scratch"
    if path.endswith((".md", ".txt", ".rst")):
        return "docs"
    return "code"


def _line_count(text: str) -> int:
    return text.count("\n") + bool(text and not text.endswith("\n"))


def _added_lines(name: str, arguments: dict) -> Iterator[tuple[str, int]]:
    if name == "write":
        kind = _path_kind(arguments.get("path", ""))
        if kind and kind != "plan":
            yield kind, _line_count(arguments.get("content", ""))
    elif name == "edit":
        kind = None
        count = 0
        for line in arguments.get("input", "").splitlines():
            if line.startswith("+"):
                count += 1
            elif match := EDIT_PATH.match(line):
                if kind and kind != "plan":
                    yield kind, count
                kind = _path_kind(match[1])
                count = 0
        if kind and kind != "plan":
            yield kind, count


def _wait_kind(message: dict) -> str:
    text = "\n".join(item["text"] for item in message.get("content", []) if item.get("type") == "text")
    if "## Completed" in text:
        return "completed"
    if "No job finished" in text:
        return "empty"
    return "other"


def _agent_role(relative_path: Path, agents: dict[str, str]) -> tuple[str, str | None]:
    name = relative_path.stem
    if name == "__advisor":
        if len(relative_path.parts) == 1:
            return "advisor", None
        for parent in reversed(relative_path.parts[:-1]):
            agent = agents.get(parent, "task")
            if agent.startswith("adversarial-reviewer"):
                return "reviewer", REVIEW_VARIANTS.get(agent)
        return "other", None
    agent = agents.get(name, "task")
    if agent.startswith("adversarial-reviewer"):
        return "reviewer", REVIEW_VARIANTS.get(agent)
    if agent == "synth":
        return "synth", None
    return "other", None


def _read_review(path: Path, review: dict) -> None:
    review["runs"] += 1
    try:
        with path.open(encoding="utf-8") as report:
            for line in report:
                if match := REVIEW_FINDING.match(line):
                    review[match[1].lower()] += 1
    except FileNotFoundError:
        pass


def _collect_agents(directory: Path, agents: dict[str, str], run: dict) -> None:
    for transcript in directory.rglob("*.jsonl"):
        if transcript.name == "changes.jsonl" or not transcript.is_file():
            continue
        role, variant = _agent_role(transcript.relative_to(directory), agents)
        cost, tokens, lines = 0, 0, 0
        with transcript.open("rb") as source:
            for record in _records(source):
                if record.get("type") != "message" or record["message"].get("role") != "assistant":
                    continue
                message = record["message"]
                turn_cost, turn_tokens = _usage(message)
                cost += turn_cost
                tokens += turn_tokens
                for call in _calls(message):
                    lines += sum(count for _, count in _added_lines(call["name"], call.get("arguments", {})))
        run["cost"][role] += cost
        run["output_tokens"][role] += tokens
        run["lines"]["synth" if role == "synth" else "other"] += lines
        if variant:
            review = run["review"][variant]
            review["cost"] += cost
            if transcript.stem != "__advisor":
                _read_review(transcript.with_suffix(".md"), review)


def _collect_main(records: Iterator[dict], header: dict) -> tuple[dict, dict[str, str]]:
    run = {
        "session": header["id"], "project": header["cwd"], "started": header["timestamp"],
        "cost": dict.fromkeys(ROLES, 0),
        "output_tokens": dict.fromkeys(ROLES, 0),
        "main_turns": 0, "synth_slices": 0,
        "lines": dict.fromkeys(("main_code", "main_docs", "main_scratch", "synth", "other"), 0),
        "waits": dict.fromkeys(("empty", "completed", "other"), 0),
        "main_shell_file_write_lines": 0,
        "review": {variant: dict.fromkeys(("runs", "crit", "warn", "cost"), 0) for variant in REVIEW_VARIANTS.values()},
    }
    agents = {}
    for record in records:
        if record.get("type") != "message":
            continue
        message = record["message"]
        if message.get("role") == "toolResult" and message.get("toolName") == "wait":
            run["waits"][_wait_kind(message)] += 1
        if message.get("role") != "assistant":
            continue
        run["main_turns"] += 1
        cost, tokens = _usage(message)
        run["cost"]["main"] += cost
        run["output_tokens"]["main"] += tokens
        for call in _calls(message):
            name, arguments = call["name"], call.get("arguments", {})
            if name == "task":
                slices = 0
                for item in arguments.get("tasks", []):
                    agent = item.get("agent", "task")
                    if item.get("name"):
                        agents[item["name"]] = agent
                    slices += agent == "synth"
                run["synth_slices"] += slices
            elif name in ("bash", "eval"):
                script = arguments.get("command" if name == "bash" else "code", "")
                if SHELL_WRITE.search(script):
                    run["main_shell_file_write_lines"] += _line_count(script)
            else:
                for kind, count in _added_lines(name, arguments):
                    run["lines"][f"main_{kind}"] += count
    return run, agents


def _collect_run(session_file: Path, since: str | None, until: str | None, project: str | None) -> dict | None:
    with session_file.open("rb") as source:
        records = _records(source)
        header = next((record for record in records if record.get("type") == "session"), None)
        if header is None:
            return None
        started = header["timestamp"]
        if (since is not None and started < since) or (until is not None and started >= until):
            return None
        if project is not None and project not in header["cwd"].casefold():
            return None
        run, agents = _collect_main(records, header)
    if not run["synth_slices"]:
        return None
    _collect_agents(session_file.with_suffix(""), agents, run)
    cost_total = sum(run["cost"].values())
    run.update(
        cost_total=cost_total,
        main_cost_share=run["cost"]["main"] / cost_total if cost_total else 0,
        main_turns_per_slice=run["main_turns"] / run["synth_slices"],
        small_run=run["lines"]["synth"] < 50,
    )
    return run


def collect(root: Path, since: str | None = None, until: str | None = None, project: str | None = None) -> list[dict]:
    project = project.casefold() if project is not None else None
    runs = []
    for session_file in root.glob("*/*.jsonl"):
        if session_file.is_file() and (run := _collect_run(session_file, since, until, project)) is not None:
            runs.append(run)
    return sorted(runs, key=lambda run: run["started"])


def _text_row(started: str, metrics: tuple, small: str) -> str:
    turns, slices, synth_lines, empty, completed, main, synth, cost, write_lines, slow, alt, _ = metrics
    turns_per_slice = turns / slices if slices else 0
    main_share = main / cost if cost else 0
    return (
        f"{started}\t{turns}\t{slices}\t{turns_per_slice:.1f}\t{synth_lines}\t{empty}\t{completed}\t"
        f"{main:.2f}\t{synth:.2f}\t{main_share:.1%}\t{write_lines}\t{slow}\t{alt}\t{small}"
    )


def _print_text(runs: list[dict]) -> None:
    print(
        "STARTED\tMAIN_TURNS\tSYNTH_SLICES\tTURNS/SLICE\tSYNTH_LINES\tEMPTY_WAITS\tCOMPLETED_WAITS\t"
        "MAIN_COST\tSYNTH_COST\tMAIN_COST_SHARE\tSHELL_WRITE_LINES\tSLOW_FINDINGS\tALT_FINDINGS\tSMALL"
    )
    totals = (0,) * 12
    for run in runs:
        slow, alt = run["review"]["slow"], run["review"]["alt"]
        metrics = (
            run["main_turns"], run["synth_slices"], run["lines"]["synth"], run["waits"]["empty"],
            run["waits"]["completed"], run["cost"]["main"], run["cost"]["synth"], run["cost_total"],
            run["main_shell_file_write_lines"], slow["crit"] + slow["warn"], alt["crit"] + alt["warn"], run["small_run"],
        )
        print(_text_row(run["started"], metrics, "small" if run["small_run"] else "-"))
        totals = tuple(a + b for a, b in zip(totals, metrics))
    print(_text_row("TOTAL", totals, str(totals[-1])))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sessions-root", type=Path, default=Path("~/.omp/agent/sessions"))
    parser.add_argument("--since", metavar="ISO")
    parser.add_argument("--until", metavar="ISO")
    parser.add_argument("--project", metavar="TEXT")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    root = args.sessions_root.expanduser()
    if not root.is_dir():
        print(f"session_metrics: no sessions directory: {root}", file=sys.stderr)
        return 2
    runs = collect(root, args.since, args.until, args.project)
    if args.json:
        print(json.dumps(runs))
    else:
        _print_text(runs)
    return 0


if __name__ == "__main__":
    sys.exit(main())
