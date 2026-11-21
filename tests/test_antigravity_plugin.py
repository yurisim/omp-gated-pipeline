"""Validation tests for Antigravity plugin metadata, rules, skills, and agent references."""

import json
import re
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILLS = ("plan-preflight", "parallel-fanout", "adversarial-review")
FRONTMATTER_RE = re.compile(r"\A---\r?\n(.*?)\r?\n---\r?\n", re.DOTALL)
MD_LINK_RE = re.compile(r"\[[^\]]+\]\((\.\.?/[^)]+)\)")


def parse_frontmatter(text):
    """Extract raw YAML frontmatter block and body from markdown text."""
    match = FRONTMATTER_RE.match(text)
    if not match:
        return None, text
    return match.group(1), text[match.end():]


class AntigravityPluginTest(unittest.TestCase):
    """Validates root plugin.json, OMP package.json, rule frontmatter, skill links, and agent refs."""

    def test_root_plugin_manifest(self):
        plugin_path = ROOT / "plugin.json"
        self.assertTrue(plugin_path.is_file(), "plugin.json must exist at repository root")
        data = json.loads(plugin_path.read_text(encoding="utf-8"))
        self.assertIsInstance(data, dict)
        self.assertEqual(data.get("name"), "omp-gated-pipeline")
        self.assertIsInstance(data.get("version"), str)
        self.assertTrue(data["version"].strip())
        self.assertIsInstance(data.get("description"), str)
        self.assertTrue(data["description"].strip())
        repo = data.get("repository")
        self.assertIsInstance(repo, dict)
        self.assertEqual(repo.get("type"), "git")
        self.assertTrue(isinstance(repo.get("url"), str) and "omp-gated-pipeline" in repo["url"])

    def test_omp_package_json_preserved(self):
        pkg_path = ROOT / "package.json"
        self.assertTrue(pkg_path.is_file(), "package.json must exist at repository root")
        data = json.loads(pkg_path.read_text(encoding="utf-8"))
        self.assertEqual(data.get("name"), "omp-gated-pipeline")
        self.assertIs(data.get("private"), True)
        self.assertIsInstance(data.get("version"), str)
        self.assertTrue(data["version"])
        self.assertIsInstance(data.get("description"), str)
        self.assertTrue(data["description"])
        self.assertIsInstance(data.get("omp"), dict)

    def test_rule_frontmatter_and_antigravity_note(self):
        rule_path = ROOT / "rules" / "gated-pipeline.md"
        text = rule_path.read_text(encoding="utf-8")
        frontmatter, body = parse_frontmatter(text)
        self.assertIsNotNone(frontmatter, "rules/gated-pipeline.md must start with YAML frontmatter")
        self.assertRegex(frontmatter, r"(?m)^description:\s+\S+")
        self.assertRegex(frontmatter, r"(?m)^alwaysApply:\s+true\s*$")
        self.assertRegex(frontmatter, r"(?m)^trigger:\s+always_on\s*$")
        self.assertRegex(frontmatter, r"(?m)^agents:\s+main\s*$")
        self.assertIn("Antigravity runtime:", body)
        self.assertIn("antigravity.md", body)
        self.assertIn("invoke_subagent", body)

    def test_skills_link_to_antigravity_and_back(self):
        for skill in SKILLS:
            with self.subTest(skill=skill):
                skill_dir = ROOT / "skills" / skill
                skill_md = skill_dir / "SKILL.md"
                ag_md = skill_dir / "antigravity.md"
                self.assertTrue(skill_md.is_file(), f"Missing {skill_md}")
                self.assertTrue(ag_md.is_file(), f"Missing {ag_md}")

                skill_text = skill_md.read_text(encoding="utf-8")
                frontmatter, skill_body = parse_frontmatter(skill_text)
                self.assertIsNotNone(frontmatter, f"{skill_md} missing YAML frontmatter")
                self.assertRegex(frontmatter, rf"(?m)^name:\s+{re.escape(skill)}\s*$")
                self.assertRegex(frontmatter, r"(?m)^description:\s+\S+")
                self.assertIn("[antigravity.md](./antigravity.md)", skill_body)

                ag_text = ag_md.read_text(encoding="utf-8")
                self.assertIn("[SKILL.md](./SKILL.md)", ag_text)
                for target in MD_LINK_RE.findall(ag_text):
                    resolved = (skill_dir / target).resolve()
                    self.assertTrue(resolved.exists(), f"{ag_md} links to missing target {target}")

    def test_synth_and_reviewer_references(self):
        synth_path = ROOT / "agents" / "synth.md"
        reviewer_path = ROOT / "skills" / "adversarial-review" / "reviewer.md"
        preflight_script = ROOT / "skills" / "plan-preflight" / "preflight.py"
        self.assertTrue(synth_path.is_file())
        self.assertTrue(reviewer_path.is_file())
        self.assertTrue(preflight_script.is_file())

        synth_fm, _ = parse_frontmatter(synth_path.read_text(encoding="utf-8"))
        self.assertIsNotNone(synth_fm)
        self.assertRegex(synth_fm, r"(?m)^name:\s+synth\s*$")
        self.assertRegex(synth_fm, r"(?m)^structured:\s+true\s*$")
        for key in ("edits", "lines", "planDeviations", "checks", "specConflict"):
            self.assertRegex(synth_fm, rf"\b{key}\b")

        fanout_ag = (ROOT / "skills" / "parallel-fanout" / "antigravity.md").read_text(encoding="utf-8")
        self.assertIn("../../agents/synth.md", fanout_ag)
        self.assertTrue((ROOT / "skills" / "parallel-fanout" / "../../agents/synth.md").resolve().is_file())
        self.assertIn("define_subagent", fanout_ag)
        self.assertIn("invoke_subagent", fanout_ag)
        self.assertIn("send_message", fanout_ag)
        for key in ("edits", "lines", "planDeviations", "checks", "specConflict"):
            self.assertIn(key, fanout_ag)

        review_ag = (ROOT / "skills" / "adversarial-review" / "antigravity.md").read_text(encoding="utf-8")
        self.assertIn("[reviewer.md](./reviewer.md)", review_ag)
        self.assertIn("define_subagent", review_ag)
        self.assertIn("invoke_subagent", review_ag)
        self.assertIn("send_message", review_ag)

        reviewer_text = reviewer_path.read_text(encoding="utf-8")
        self.assertIn("adversarial-reviewer", reviewer_text)
        self.assertIn("adversarial-reviewer-alt", reviewer_text)
        self.assertIn("Handoff:", reviewer_text)

        preflight_ag = (ROOT / "skills" / "plan-preflight" / "antigravity.md").read_text(encoding="utf-8")
        self.assertIn("preflight.py", preflight_ag)

    def test_quota_fallback_documented(self):
        fanout_ag = (ROOT / "skills" / "parallel-fanout" / "antigravity.md").read_text(encoding="utf-8")
        review_ag = (ROOT / "skills" / "adversarial-review" / "antigravity.md").read_text(encoding="utf-8")

        for text in (fanout_ag, review_ag):
            self.assertIn("RESOURCE_EXHAUSTED", text)
            self.assertIn("429", text)
            self.assertIn("quota_remaining", text)
            self.assertIn("quota_resets", text)
            self.assertIn("ask_question", text)
            self.assertRegex(text, r'swarm\{action:\s*"models"')
            self.assertRegex(text, r'swarm\{action:\s*"add"')
            self.assertRegex(text, r'swarm\{action:\s*"kill"')

        self.assertIn("OWNERS", fanout_ag)
        self.assertIn("planDeviations", fanout_ag)
        self.assertIn("never fall back to inline coordinator edits", fanout_ag)
        self.assertIn("different family/line", review_ag)


class AntigravityHookTest(unittest.TestCase):
    """Validates hooks.json and the plan-preflight PreToolUse hook."""

    HOOK = ROOT / "tools" / "antigravity_preflight_hook.py"

    def run_hook(self, stdin_text):
        result = subprocess.run(
            [sys.executable, str(self.HOOK)], input=stdin_text,
            capture_output=True, text=True, encoding="utf-8", timeout=30,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def payload(self, path, content, root, **extra):
        args = {"Path": path, "Content": content}
        args.update(extra)
        return json.dumps({
            "toolCall": {"name": "write_file", "args": args},
            "cwd": str(root),
        })

    def test_hooks_json(self):
        data = json.loads((ROOT / "hooks.json").read_text(encoding="utf-8"))
        groups = data["plan-preflight-gate"]["PreToolUse"]
        self.assertEqual(groups[0]["matcher"], "write_file")
        self.assertIn("antigravity_preflight_hook.py", groups[0]["hooks"][0]["command"])
        self.assertTrue(self.HOOK.is_file())

    def test_non_plan_file_allowed(self):
        out = self.run_hook(self.payload("notes.md", "## Parallel waves\nnothing", ROOT))
        self.assertEqual(out["decision"], "allow")

    def test_valid_plan_allowed(self):
        plan = "## Parallel waves\n\nSerial: one file\nAcceptance: python -c pass\n"
        out = self.run_hook(self.payload("implementation_plan.md", plan, ROOT))
        self.assertEqual(out["decision"], "allow")

    def test_broken_plan_denied(self):
        slice_spec = [{
            "id": "S1", "agent": "synth", "owns": ["no/such/file.py"], "reads": [],
            "symbols": [], "invariants": [], "tests": [], "acceptance": "x",
        }]
        plan = "## Parallel waves\n\n```json\n" + json.dumps(slice_spec) + "\n```\n"
        out = self.run_hook(self.payload("x-plan.md", plan, ROOT))
        self.assertEqual(out["decision"], "deny")
        self.assertIn("PATH_MISSING", out["reason"])

    def test_malformed_stdin_fails_open(self):
        self.assertEqual(self.run_hook("not json")["decision"], "allow")


if __name__ == "__main__":
    unittest.main()
