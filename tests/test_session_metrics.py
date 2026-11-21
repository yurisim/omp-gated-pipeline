"""Behavior tests for tools/session_metrics.py (stdlib unittest)."""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "tools" / "session_metrics.py"
START = "2026-11-17T01:10:00Z"


def call(name, **arguments):
    return {"type": "toolCall", "id": f"call-{name}", "name": name, "arguments": arguments}


def assistant(*calls, output=None, cost=None):
    message = {"role": "assistant", "content": list(calls)}
    if output is not None:
        message.setdefault("usage", {})["output"] = output
    if cost is not None:
        message.setdefault("usage", {})["cost"] = {"total": cost}
    return {"type": "message", "message": message}


SYNTH = call("task", tasks=[{"name": "S1", "agent": "synth"}])


class SessionMetricsTest(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)

    def write(self, relative, text):
        path = self.root / "project" / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def transcript(self, relative, *records):
        self.write(relative, "\n".join(record if isinstance(record, str) else json.dumps(record) for record in records))

    def session(self, name, *records, started=START):
        self.transcript(
            f"{name}.jsonl", {"type": "session", "id": name, "timestamp": started, "cwd": "/work/Project"}, *records,
        )

    def run_script(self, *args, root=None):
        return subprocess.run(
            [sys.executable, str(SCRIPT), "--sessions-root", str(self.root if root is None else root), "--json", *args],
            capture_output=True, text=True, encoding="utf-8",
        )

    def runs(self, *args):
        result = self.run_script(*args)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_session_without_synth_is_not_reported(self):
        self.session("ordinary", assistant(call("task", tasks=[{"name": "Scout"}])))
        self.assertEqual(self.runs(), [])

    def test_roles_include_nested_and_top_level_advisors(self):
        self.session(
            "run",
            assistant(call("bash", command="echo before")),
            assistant(SYNTH, output=12, cost=1.0),
            assistant(call("eval", code="print('during')")),
            assistant(call("task", tasks=[{"name": "Review", "agent": "adversarial-reviewer"}])),
            assistant(call("bash", command="echo after")),
        )
        self.transcript("run/S1.jsonl", assistant(output=10, cost=0.5))
        self.transcript("run/Review.jsonl", assistant(output=8, cost=0.25))
        self.transcript("run/Review/__advisor.jsonl", assistant(output=6, cost=0.125))
        self.transcript("run/__advisor.jsonl", assistant(output=4, cost=0.0625))
        self.transcript("run/Unlisted.jsonl", assistant(output=2, cost=0.03125))
        self.transcript("run/changes.jsonl", assistant(output=999, cost=999))
        self.write("run/Review.md", "- CRIT: first\n- WARN: second\n- WARN: third\n  - WARN: not a finding\n")

        run, = self.runs()
        self.assertEqual(run["cost"], {"main": 1.0, "synth": 0.5, "reviewer": 0.375, "advisor": 0.0625, "other": 0.03125})
        self.assertEqual(run["output_tokens"], {"main": 12, "synth": 10, "reviewer": 14, "advisor": 4, "other": 2})
        self.assertEqual(run["review"]["slow"], {"runs": 1, "crit": 1, "warn": 2, "cost": 0.375})
        self.assertEqual(run["main_shell_calls_in_waves"], 1)

    def test_added_lines_by_path_kind(self):
        edit = "\n".join((
            "*** Begin Patch",
            "[src/task.py#AB12]", "PUT 1.=1:", "+one", "+two",
            r"[C:\TMP\result.txt#cD34]", "PUT >1:", "+three",
            "*** End Patch",
        ))
        self.session("run", assistant(
            SYNTH, call("edit", input=edit),
            call("write", path="README.md", content="one\ntwo\nthree"),
            call("write", path="NOTES.md", content="a\nb\n"),
            call("write", path="local://x-plan.md", content="ignored"),
            call("write", path="agent://S1", content="ignored"),
        ))
        run, = self.runs()
        self.assertEqual(run["lines"], {"main_code": 2, "main_docs": 5, "main_scratch": 1, "synth": 0, "other": 0})

    def test_wait_outcomes(self):
        results = [
            {"type": "message", "message": {
                "role": "toolResult", "toolName": "wait", "toolCallId": f"wait-{index}",
                "content": [{"type": "text", "text": text}],
            }}
            for index, text in enumerate(("No job finished", "## Completed\nS1\nNo job finished", "Nothing to wait for"))
        ]
        self.session("run", assistant(SYNTH), *results)
        run, = self.runs()
        self.assertEqual(run["waits"], {"empty": 1, "completed": 1, "other": 1})

    def test_since_is_inclusive_and_until_is_exclusive(self):
        until = "2026-11-21T15:00:00Z"
        self.session("at-since", assistant(SYNTH))
        self.session("at-until", assistant(SYNTH), started=until)
        self.assertEqual([run["session"] for run in self.runs("--since", START, "--until", until)], ["at-since"])

    def test_corrupt_jsonl_line_is_skipped(self):
        self.session("run", '{"type":', assistant(SYNTH))
        run, = self.runs()
        self.assertEqual((run["session"], run["synth_slices"]), ("run", 1))

    def test_missing_sessions_root_exits_two(self):
        missing = self.root / "missing"
        result = self.run_script(root=missing)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stderr, f"session_metrics: no sessions directory: {missing}\n")


if __name__ == "__main__":
    unittest.main()
