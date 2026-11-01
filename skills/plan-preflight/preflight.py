"""Read-only path, symbol, line, and changed-signature checks for plans."""

import argparse
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any


FENCE_OPEN = re.compile(r"^ {0,3}(`{3,}|~{3,})(.*)$")
HEADING = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
WAVES_HEADING = re.compile(r"^parallel waves\b", re.IGNORECASE)
SERIAL_LINE = re.compile(r"^\s*Serial:\s*\S")
ACCEPTANCE_LINE = re.compile(r"^\s*Acceptance:\s*\S")
INLINE_CODE = re.compile(r"(?<!`)(`+)(?!`)(.*?)(?<!`)\1(?!`)")
ANCHOR = re.compile(r"((?:[A-Za-z]:)?[^\s`:]*\.[A-Za-z][^/\\\s`:.]*):([0-9]+(?:-[0-9]+)?(?:,[0-9]+(?:-[0-9]+)?)*)")
ANCHOR_SYMBOL = re.compile(r"[A-Za-z_][A-Za-z0-9_.]*(?:\(\))?")
PRUNED_DIRS = {
    ".git", "node_modules", "dist", "build", ".venv", "venv",
    "__pycache__", ".scratch", ".nx", ".angular", "coverage",
}


def diagnostic(code: str, sid: str | None, line: int | None, detail: str) -> dict[str, Any]:
    return {"code": code, "slice": sid, "line": line, "detail": detail}


def strip_tag(value: str) -> tuple[bool, str]:
    value = value.strip()
    if value.startswith("[NEW]"):
        return True, value[len("[NEW]"):].strip()
    return False, value


def normalize_path(value: str) -> tuple[bool, str]:
    is_new, value = strip_tag(value)
    value = value.replace("\\", "/")
    if value.startswith("./"):
        value = value[2:]
    return is_new, value


def resolve_path(root: Path, value: str) -> Path:
    path = Path(value).expanduser()
    return (path if path.is_absolute() else root / path).resolve()


def find_root(value: str | None) -> Path:
    if value is not None:
        return Path(value).expanduser().resolve()
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
        )
        if result.returncode == 0:
            return Path(result.stdout.rstrip("\r\n")).resolve()
    except OSError:
        pass
    return Path.cwd().resolve()


def extract_slices(text: str) -> tuple[list[tuple[dict[str, Any], int]], list[dict[str, Any]]]:
    slices: list[tuple[dict[str, Any], int]] = []
    diagnostics: list[dict[str, Any]] = []
    waves_level: int | None = None
    fence_close: re.Pattern[str] | None = None
    fence_line = 0
    capture_json = False
    body: list[str] = []
    serial = False
    acceptance = False
    saw_json = False

    def parse_block() -> None:
        try:
            block = json.loads("\n".join(body))
        except json.JSONDecodeError as error:
            diagnostics.append(diagnostic(
                "BAD_SPEC", None, fence_line, f"invalid JSON in wave block: {error}",
            ))
            return
        if (
            isinstance(block, list) and block
            and all(isinstance(item, dict) and ("id" in item or "owns" in item) for item in block)
        ):
            slices.extend((item, fence_line) for item in block)

    for line_number, line in enumerate(text.replace("\r\n", "\n").split("\n"), 1):
        if fence_close is not None:
            if fence_close.fullmatch(line):
                if capture_json:
                    parse_block()
                fence_close = None
                capture_json = False
                body = []
            elif capture_json:
                body.append(line)
            continue

        opener = FENCE_OPEN.match(line)
        if opener:
            fence, info = opener.groups()
            fence_close = re.compile(r"^ {0,3}" + re.escape(fence[0]) + "{" + str(len(fence)) + r",}\s*$")
            fence_line = line_number
            words = info.split(maxsplit=1)
            capture_json = waves_level is not None and bool(words) and words[0].lower() == "json"
            if capture_json:
                saw_json = True
            continue

        heading = HEADING.match(line)
        if heading:
            level = len(heading[1])
            if waves_level is None:
                if level in (2, 3) and WAVES_HEADING.match(heading[2]):
                    waves_level = level
            elif level <= waves_level:
                break
        elif waves_level is not None:
            if SERIAL_LINE.match(line):
                serial = True
            elif ACCEPTANCE_LINE.match(line):
                acceptance = True

    if fence_close is not None and capture_json:
        parse_block()
    if waves_level is None:
        diagnostics.append(diagnostic("BAD_SPEC", None, None, "no `## Parallel waves` section"))
    elif not slices and not diagnostics:
        if not serial or saw_json:
            diagnostics.append(diagnostic("BAD_SPEC", None, None, "no slice spec arrays under Parallel waves"))
        elif not acceptance:
            diagnostics.append(diagnostic(
                "BAD_SPEC", None, None,
                "serial plan without slice JSON needs an `Acceptance: <command>` line under Parallel waves",
            ))
    return slices, diagnostics


def validate_slices(
    slices: list[tuple[dict[str, Any], int]],
) -> tuple[list[tuple[dict[str, Any], int]], list[dict[str, Any]]]:
    valid: list[tuple[dict[str, Any], int]] = []
    diagnostics: list[dict[str, Any]] = []
    seen: set[str] = set()
    for spec, line in slices:
        errors: list[str] = []
        sid = spec.get("id")
        usable_id = isinstance(sid, str) and bool(sid.strip())
        if not usable_id:
            errors.append("id must be a non-empty string")
        elif sid in seen:
            errors.append(f"duplicate slice id `{sid}`")
        else:
            seen.add(sid)
        for field in ("agent", "acceptance"):
            if not isinstance(spec.get(field), str):
                errors.append(f"{field} must be a string")
        for field in ("owns", "reads", "tests"):
            values = spec.get(field)
            if not isinstance(values, list) or not all(isinstance(value, str) for value in values):
                errors.append(f"{field} must be a list of strings")
        symbols = spec.get("symbols")
        if not isinstance(symbols, list) or not all(
            isinstance(symbol, dict)
            and all(isinstance(symbol.get(field), str) for field in ("path", "name", "signature"))
            for symbol in symbols
        ):
            errors.append("symbols must be a list of objects with string path, name, and signature")
        if not isinstance(spec.get("invariants"), list):
            errors.append("invariants must be a list")
        if errors:
            diagnostics.append(diagnostic("BAD_SPEC", sid if usable_id else "?", line, "; ".join(errors)))
        else:
            valid.append((spec, line))
    return valid, diagnostics


def path_entries(spec: dict[str, Any]):
    for field in ("owns", "reads"):
        for value in spec[field]:
            yield field, *normalize_path(value)
    for symbol in spec["symbols"]:
        yield "symbols", *normalize_path(symbol["path"])


def word_pattern(segment: str) -> re.Pattern[str]:
    return re.compile(r"(?<![\w$])" + re.escape(segment) + r"(?![\w$])")


def references(root: Path, ident: str) -> set[str]:
    try:
        result = subprocess.run(
            ["git", "-c", "core.quotepath=off", "-C", str(root), "grep", "-l", "-I", "-w", "-F", "--untracked", "-e", ident],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
        )
        if result.returncode in (0, 1):
            return {normalize_path(path)[1] for path in result.stdout.splitlines()}
    except OSError:
        pass

    found: set[str] = set()
    pattern = word_pattern(ident)
    for directory, dirs, files in os.walk(root):
        dirs[:] = [name for name in dirs if name not in PRUNED_DIRS]
        for name in files:
            path = Path(directory) / name
            try:
                if path.stat().st_size > 1_000_000:
                    continue
                data = path.read_bytes()
            except OSError:
                continue
            if b"\0" not in data and pattern.search(data.decode("utf-8", errors="ignore")):
                found.add(path.relative_to(root).as_posix())
    return found


def check_slices(slices: list[tuple[dict[str, Any], int]], root: Path) -> list[dict[str, Any]]:
    new_paths: set[str] = set()
    accounted: set[Path] = set()
    resolved: dict[str, Path] = {}
    file_text: dict[Path, str] = {}
    normalized_text: dict[Path, str] = {}
    refs: dict[str, set[str]] = {}
    diagnostics: list[dict[str, Any]] = []

    def resolve(value: str) -> Path:
        if value not in resolved:
            resolved[value] = resolve_path(root, value)
        return resolved[value]

    for spec, _ in slices:
        for _, is_new, path in path_entries(spec):
            if is_new:
                new_paths.add(path)
            else:
                accounted.add(resolve(path))
        for test in spec["tests"]:
            accounted.add(resolve(normalize_path(test.split("::", 1)[0])[1]))

    for spec, line in slices:
        sid = spec["id"]
        symbol_diagnostics: list[dict[str, Any]] = []
        caller_diagnostics: list[dict[str, Any]] = []
        for field, is_new, path in path_entries(spec):
            if not is_new and path not in new_paths and not resolve(path).exists():
                diagnostics.append(diagnostic(
                    "PATH_MISSING", sid, line,
                    f"{field} path `{path}` does not exist (tag it [NEW] if the plan creates it)",
                ))
        for symbol in spec["symbols"]:
            path_is_new, path = normalize_path(symbol["path"])
            name_is_new, name = strip_tag(symbol["name"])
            if name_is_new or path_is_new or path in new_paths:
                continue
            target = resolve(path)
            if not target.exists():
                continue
            segments = [piece.split("(", 1)[0] for piece in re.split(r"::|[.#:]+", name)]
            segments = [segment for segment in segments if segment]
            if target not in file_text:
                try:
                    file_text[target] = target.read_text(encoding="utf-8", errors="ignore")
                except OSError:
                    file_text[target] = ""
            text = file_text[target]
            missing = [segment for segment in segments if not word_pattern(segment).search(text)]
            if missing:
                symbol_diagnostics.append(diagnostic(
                    "SYMBOL_MISSING", sid, line,
                    f"`{name}` not found in {path} (missing: {', '.join(missing)})",
                ))
                continue
            signature = re.sub(r"\s+", " ", symbol["signature"]).strip()
            if not signature or not segments:
                continue
            if target not in normalized_text:
                normalized_text[target] = re.sub(r"\s+", " ", text).strip()
            if signature in normalized_text[target]:
                continue
            ident = segments[-1]
            if ident not in refs:
                refs[ident] = references(root, ident)
            unlisted: list[str] = []
            for ref in refs[ident]:
                ref_path = resolve(ref)
                if ref_path == target:
                    continue
                if not any(ref_path == entry or ref_path.is_relative_to(entry) for entry in accounted):
                    unlisted.append(ref)
            unlisted.sort()
            for ref in unlisted[:25]:
                caller_diagnostics.append(diagnostic(
                    "UNLISTED_CALLER", sid, line,
                    f"{ref} references `{ident}`, whose signature changes in {path}; list it in some slice's owns or reads",
                ))
            if len(unlisted) > 25:
                caller_diagnostics.append(diagnostic(
                    "UNLISTED_CALLER", sid, line,
                    f"... and {len(unlisted) - 25} more files reference {ident}",
                ))
        diagnostics.extend(symbol_diagnostics)
        diagnostics.extend(caller_diagnostics)
    return diagnostics


def check_anchors(text: str, root: Path) -> tuple[list[dict[str, Any]], int]:
    diagnostics: list[dict[str, Any]] = []
    anchors = 0
    fence_close: re.Pattern[str] | None = None
    repo_files: list[str] | None = None
    repo_extensions: set[str] | None = None
    file_data: dict[str, tuple[str, int]] = {}

    def files() -> list[str]:
        nonlocal repo_files
        if repo_files is None:
            try:
                result = subprocess.run(
                    ["git", "-C", str(root), "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
                    capture_output=True,
                )
                if result.returncode == 0:
                    repo_files = list(dict.fromkeys(
                        os.fsdecode(path).replace("\\", "/")
                        for path in result.stdout.split(b"\0") if path
                    ))
            except OSError:
                pass
            if repo_files is None:
                repo_files = []
                for directory, dirs, names in os.walk(root):
                    dirs[:] = [name for name in dirs if name not in PRUNED_DIRS]
                    repo_files.extend(
                        (Path(directory) / name).relative_to(root).as_posix()
                        for name in names
                    )
        return repo_files

    def resolve_files(value: str) -> list[str]:
        path = normalize_path(value)[1]
        if Path(path).is_absolute() or path.startswith(("/", "~")) or re.match(r"^[A-Za-z]:", path):
            target = resolve_path(root, path)
            return [target.as_posix()] if target.is_file() else []
        if (root / path).is_file():
            return [path]
        return [
            name for name in files()
            if name.endswith("/" + path) and (root / name).is_file()
        ]

    def load(path: str) -> tuple[str, int]:
        if path not in file_data:
            try:
                content = (root / path).read_bytes().decode("utf-8", errors="ignore")
            except OSError:
                content = ""
            lines = content.count("\n") + int(bool(content) and not content.endswith("\n"))
            file_data[path] = content, lines
        return file_data[path]

    for line_number, line in enumerate(text.replace("\r\n", "\n").split("\n"), 1):
        if fence_close is not None:
            if fence_close.fullmatch(line):
                fence_close = None
            continue
        opener = FENCE_OPEN.match(line)
        if opener:
            fence = opener[1]
            fence_close = re.compile(r"^ {0,3}" + re.escape(fence[0]) + "{" + str(len(fence)) + r",}\s*$")
            continue

        in_range: list[str] = []
        previous_end = 0
        for span in INLINE_CODE.finditer(line):
            value = span[2]
            anchor = ANCHOR.fullmatch(value) if span[1] == "`" else None
            if anchor:
                path = normalize_path(anchor[1])[1]
                candidates = resolve_files(path)
                if not candidates and "/" not in path:
                    if repo_extensions is None:
                        repo_extensions = {
                            name.rsplit(".", 1)[1].lower() for name in files()
                            if "." in name.rsplit("/", 1)[-1]
                        }
                    if path.rsplit(".", 1)[1].lower() not in repo_extensions:
                        anchor = None
            if anchor:
                anchors += 1
                numbers = [int(number) for number in re.findall(r"[0-9]+", anchor[2])]
                in_range = []
                if 0 in numbers:
                    diagnostics.append(diagnostic(
                        "LINE_OUT_OF_RANGE", None, line_number,
                        f"`{value}` names line 0; lines start at 1",
                    ))
                    previous_end = span.end()
                    continue
                if any(int(start) > int(end) for start, end in re.findall(r"([0-9]+)-([0-9]+)", anchor[2])):
                    diagnostics.append(diagnostic(
                        "LINE_OUT_OF_RANGE", None, line_number,
                        f"`{value}` is a reversed range",
                    ))
                    previous_end = span.end()
                    continue
                highest = max(numbers)
                in_range = [name for name in candidates if highest <= load(name)[1]]
                if not candidates:
                    diagnostics.append(diagnostic(
                        "PATH_MISSING", None, line_number, f"`{value}` does not exist",
                    ))
                elif not in_range:
                    first = candidates[0]
                    diagnostics.append(diagnostic(
                        "LINE_OUT_OF_RANGE", None, line_number,
                        f"`{value}` is past the end of {first} ({load(first)[1]} lines)",
                    ))
            else:
                if not re.fullmatch(r"[\s,/]*", line[previous_end:span.start()]):
                    in_range = []
                if (
                    in_range and span[1] == "`" and ANCHOR_SYMBOL.fullmatch(value)
                    and not resolve_files(value)
                ):
                    segments = [segment for segment in value.removesuffix("()").split(".") if segment]
                    patterns = [(segment, word_pattern(segment)) for segment in segments]
                    first_missing: list[str] = []
                    for index, name in enumerate(in_range):
                        missing = [segment for segment, pattern in patterns if not pattern.search(load(name)[0])]
                        if not missing:
                            break
                        if index == 0:
                            first_missing = missing
                    else:
                        diagnostics.append(diagnostic(
                            "SYMBOL_MISSING", None, line_number,
                            f"`{value}` not found in {in_range[0]} (missing: {', '.join(first_missing)})",
                        ))
            previous_end = span.end()
    return diagnostics, anchors


def main(argv: list[str] | None = None) -> int:
    started = time.perf_counter()
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", help="repository root (defaults to the current git root or cwd)")
    parser.add_argument("plan", help="plan file, or - to read UTF-8 from stdin")
    args = parser.parse_args(argv)
    try:
        data = sys.stdin.buffer.read() if args.plan == "-" else Path(args.plan).read_bytes()
    except OSError as error:
        parser.error(f"cannot read plan {args.plan!r}: {error}")
    root = find_root(args.root)
    text = data.decode("utf-8", errors="replace")
    extracted, diagnostics = extract_slices(text)
    anchors = 0
    if not extracted and not diagnostics:
        anchor_diagnostics, anchors = check_anchors(text, root)
        diagnostics.extend(anchor_diagnostics)
    slices, validation_diagnostics = validate_slices(extracted)
    diagnostics.extend(validation_diagnostics)
    diagnostics.extend(check_slices(slices, root))
    report = {
        "verdict": "fail" if diagnostics else "pass",
        "root": root.as_posix(),
        "slices": len(slices),
        "anchors": anchors,
        "diagnostics": diagnostics,
        "elapsed_ms": int((time.perf_counter() - started) * 1000),
    }
    print(json.dumps(report, indent=2))
    return 1 if diagnostics else 0


if __name__ == "__main__":
    raise SystemExit(main())
