"""Behavior tests for skills/plan-preflight/preflight.py (stdlib unittest)."""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "skills" / "plan-preflight" / "preflight.py"
FENCE = "`" * 3
ADD_SIG = "add(a: number, b: number): number"


def slice_spec(sid="S1", owns=(), reads=(), symbols=(), tests=()):
    return {
        "id": sid, "agent": "synth", "owns": list(owns), "reads": list(reads),
        "symbols": list(symbols), "invariants": [], "tests": list(tests), "acceptance": "n/a",
    }


def plan_text(slices, body=""):
    waves = f"{FENCE}json\n{json.dumps(slices, indent=2)}\n{FENCE}\n"
    return f"# Plan\n\n## Context\n\n{body}\n\n## Parallel waves\n\n{waves}\n## Verification\n\nnone\n"


class PreflightTest(unittest.TestCase):
    def setUp(self):
        self._repo = tempfile.TemporaryDirectory()
        self._plans = tempfile.TemporaryDirectory()
        self.root = Path(self._repo.name)
        self.write("src/a.ts", "export function add(a: number, b: number): number {\n  return a + b;\n}\n")

    def tearDown(self):
        self._repo.cleanup()
        self._plans.cleanup()

    def write(self, rel, text):
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8", newline="")
        return path

    def run_preflight(self, plan, *extra, stdin=False):
        if stdin:
            target, data = "-", plan
        else:
            plan_path = Path(self._plans.name) / "plan.md"
            plan_path.write_text(plan, encoding="utf-8")
            target, data = str(plan_path), None
        proc = subprocess.run(
            [sys.executable, str(SCRIPT), "--root", str(self.root), *extra, target],
            input=data, capture_output=True, text=True, encoding="utf-8",
        )
        return proc.returncode, json.loads(proc.stdout)

    @staticmethod
    def codes(report):
        return [d["code"] for d in report["diagnostics"]]

    def test_existing_paths_and_unchanged_symbol_pass(self):
        spec = slice_spec(owns=["src/a.ts"], symbols=[{"path": "src/a.ts", "name": "add", "signature": ADD_SIG, "contract": "sum"}])
        code, report = self.run_preflight(plan_text([spec]))
        self.assertEqual((code, report["verdict"], report["diagnostics"], report["slices"]), (0, "pass", [], 1))

    def test_missing_owned_path_fails(self):
        code, report = self.run_preflight(plan_text([slice_spec(owns=["src/missing.ts"])]))
        self.assertEqual((code, report["verdict"]), (1, "fail"))
        diag = report["diagnostics"][0]
        self.assertEqual((diag["code"], diag["slice"]), ("PATH_MISSING", "S1"))
        self.assertIn("src/missing.ts", diag["detail"])

    def test_new_tag_exempts_paths_and_symbols(self):
        specs = [
            slice_spec("S1", owns=["[NEW] src/new.ts"], symbols=[{"path": "src/new.ts", "name": "[NEW] make", "signature": "make(): void", "contract": "c"}]),
            slice_spec("S2", owns=["src/a.ts"], reads=["src/new.ts"]),
        ]
        code, report = self.run_preflight(plan_text(specs))
        self.assertEqual((code, report["diagnostics"]), (0, []))

    def test_symbol_absent_from_file_fails(self):
        spec = slice_spec(owns=["src/a.ts"], symbols=[{"path": "src/a.ts", "name": "Calc.mul", "signature": "mul(a: number): number", "contract": "c"}])
        code, report = self.run_preflight(plan_text([spec]))
        self.assertEqual((code, self.codes(report)), (1, ["SYMBOL_MISSING"]))
        self.assertIn("Calc", report["diagnostics"][0]["detail"])

    def test_signature_change_flags_unlisted_caller_until_listed(self):
        self.write("src/b.ts", "import { add } from './a';\nexport const three = add(1, 2);\n")
        self.write("src/c.ts", "export const unrelated = 1;\n")
        changed = {"path": "src/a.ts", "name": "add", "signature": "add(a: string): string", "contract": "c"}
        for use_git in (False, True):
            with self.subTest(git=use_git):
                if use_git:
                    subprocess.run(["git", "init", "-q", str(self.root)], check=True)
                code, report = self.run_preflight(plan_text([slice_spec(owns=["src/a.ts"], symbols=[changed])]))
                self.assertEqual((code, self.codes(report)), (1, ["UNLISTED_CALLER"]))
                self.assertIn("src/b.ts", report["diagnostics"][0]["detail"])
                listed = slice_spec(owns=["src/a.ts"], reads=["src/b.ts"], symbols=[changed])
                code, report = self.run_preflight(plan_text([listed]))
                self.assertEqual((code, report["diagnostics"]), (0, []))

    def test_autosaved_plan_copies_are_not_callers(self):
        self.write(".omp/plans/OLD_PLAN.md", "Change `add` to take strings.\n")
        self.write("pkg/.omp/plans/OLD_PLAN.md", "Change `add` to take strings.\n")
        changed = {"path": "src/a.ts", "name": "add", "signature": "add(a: string): string", "contract": "c"}
        for use_git in (False, True):
            with self.subTest(git=use_git):
                if use_git:
                    subprocess.run(["git", "init", "-q", str(self.root)], check=True)
                code, report = self.run_preflight(plan_text([slice_spec(owns=["src/a.ts"], symbols=[changed])]))
                self.assertEqual((code, report["verdict"], report["diagnostics"]), (0, "pass", []))

    def test_missing_waves_section_and_bad_json_fail(self):
        code, report = self.run_preflight("# Plan\n\n## Context\n\nnothing\n")
        self.assertEqual((code, self.codes(report)), (1, ["BAD_SPEC"]))
        bad = f"# Plan\n\n## Parallel waves\n\n{FENCE}json\n[{{\"id\": \"S1\",]\n{FENCE}\n"
        code, report = self.run_preflight(bad)
        self.assertEqual((code, self.codes(report)), (1, ["BAD_SPEC"]))

    def test_serial_plan_without_json_needs_acceptance_line(self):
        waves = "# Plan\n\n## Parallel waves\n\nSerial: one file, nothing to split.\n"
        code, report = self.run_preflight(waves + "\nAcceptance: `python check.py`\n\n## Verification\n\nnone\n")
        self.assertEqual((code, report["verdict"], report["slices"], report["diagnostics"]), (0, "pass", 0, []))
        code, report = self.run_preflight(waves + "\n## Verification\n\nnone\n")
        self.assertEqual((code, self.codes(report)), (1, ["BAD_SPEC"]))
        self.assertIn("Acceptance:", report["diagnostics"][0]["detail"])

    def test_serial_form_rejects_lines_outside_section_in_fences_or_beside_json(self):
        outside = "# Plan\n\n## Context\n\nSerial: x\nAcceptance: y\n\n## Parallel waves\n\nnothing\n"
        fenced = f"# Plan\n\n## Parallel waves\n\n{FENCE}text\nSerial: x\nAcceptance: y\n{FENCE}\n"
        with_json = f"# Plan\n\n## Parallel waves\n\nSerial: x\nAcceptance: y\n\n{FENCE}json\n[]\n{FENCE}\n"
        for name, text in (("outside", outside), ("fenced", fenced), ("with_json", with_json)):
            with self.subTest(name):
                code, report = self.run_preflight(text)
                self.assertEqual((code, self.codes(report)), (1, ["BAD_SPEC"]))

    def test_slice_missing_required_key_fails(self):
        spec = slice_spec(owns=["src/a.ts"])
        del spec["acceptance"]
        code, report = self.run_preflight(plan_text([spec]))
        self.assertEqual((code, self.codes(report)), (1, ["BAD_SPEC"]))

    def test_heading_inside_fence_does_not_end_waves_section(self):
        spec = slice_spec(owns=["src/a.ts"])
        text = (
            "# Plan\n\n## Parallel waves\n\n"
            f"{FENCE}markdown\n## 0. Baseline\n{FENCE}\n\n"
            f"{FENCE}json\n{json.dumps([spec])}\n{FENCE}\n"
        )
        code, report = self.run_preflight(text)
        self.assertEqual((code, report["slices"]), (0, 1))

    def test_plan_from_stdin(self):
        code, report = self.run_preflight(plan_text([slice_spec(owns=["src/a.ts"])]), stdin=True)
        self.assertEqual((code, report["verdict"]), (0, "pass"))

    def test_malformed_slice_in_later_wave_is_reported_not_skipped(self):
        bad = slice_spec("S2", owns=["src/missing.ts"])
        bad["own"] = bad.pop("owns")
        text = plan_text([slice_spec(owns=["src/a.ts"])]).replace(
            "\n## Verification", f"{FENCE}json\n{json.dumps([bad])}\n{FENCE}\n\n## Verification",
        )
        code, report = self.run_preflight(text)
        self.assertEqual((code, self.codes(report), report["diagnostics"][0]["slice"]), (1, ["BAD_SPEC"], "S2"))

    def test_duplicate_slice_id_fails(self):
        specs = [slice_spec("S1", owns=["src/a.ts"]), slice_spec("S1", reads=["src/a.ts"])]
        code, report = self.run_preflight(plan_text(specs))
        self.assertEqual((code, self.codes(report), report["slices"]), (1, ["BAD_SPEC"], 1))

    def test_tests_file_and_directory_entries_account_for_callers(self):
        self.write("src/lib/b.ts", "import { add } from '../a';\nexport const three = add(1, 2);\n")
        changed = {"path": "src/a.ts", "name": "add", "signature": "add(a: string): string", "contract": "c"}
        for extra in ({"tests": ["src/lib/b.ts::uses add"]}, {"reads": ["src/lib"]}, {"reads": ["./src/lib/"]}):
            with self.subTest(**{k: v[0] for k, v in extra.items()}):
                spec = slice_spec(owns=["src/a.ts"], symbols=[changed], **extra)
                code, report = self.run_preflight(plan_text([spec]))
                self.assertEqual((code, report["diagnostics"]), (0, []))

    def test_unlisted_callers_capped_at_25_plus_summary(self):
        for index in range(27):
            self.write(f"src/use{index:02}.ts", "import { add } from './a';\nadd(1, 2);\n")
        changed = {"path": "src/a.ts", "name": "add", "signature": "add(a: string): string", "contract": "c"}
        code, report = self.run_preflight(plan_text([slice_spec(owns=["src/a.ts"], symbols=[changed])]))
        details = [d["detail"] for d in report["diagnostics"]]
        self.assertEqual((code, len(details)), (1, 26))
        self.assertTrue(details[0].startswith("src/use00.ts references `add`"))
        self.assertEqual(details[-1], "... and 2 more files reference add")


if __name__ == "__main__":
    unittest.main()
