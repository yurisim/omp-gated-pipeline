import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

HOOK = Path(__file__).resolve().parent.parent / ".githooks" / "pre-commit"
PKG = '{\n  "name": "demo",\n  "version": "1.2.9",\n  "private": true\n}\n'


class VersionHookTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.addCleanup(tmp.cleanup)
        self.repo = Path(tmp.name)
        self.git("init", "-q")
        self.git("config", "user.name", "t")
        self.git("config", "user.email", "t@example.com")
        self.git("config", "core.autocrlf", "false")
        self.git("config", "core.hooksPath", ".githooks")
        hooks = self.repo / ".githooks"
        hooks.mkdir()
        shutil.copy(HOOK, hooks / "pre-commit")
        os.chmod(hooks / "pre-commit", 0o755)
        self.write("package.json", PKG)
        self.write("skills/a/SKILL.md", "a\n")
        self.write("README.md", "r\n")
        self.git("add", "-A")
        self.git("commit", "-q", "--no-verify", "-m", "init")

    def git(self, *args, check=True):
        result = subprocess.run(
            ["git", *args], cwd=self.repo, capture_output=True, text=True
        )
        if check and result.returncode != 0:
            self.fail(f"git {args} failed: {result.stderr}")
        return result

    def write(self, rel, text):
        path = self.repo / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(text.encode())

    def blob(self, rev):
        # Raw bytes decoded without newline translation, so CRLF stays visible.
        return subprocess.run(
            ["git", "show", rev], cwd=self.repo, capture_output=True, check=True
        ).stdout.decode()

    def committed_pkg(self):
        return self.blob("HEAD:package.json")

    def commit_count(self):
        return int(self.git("rev-list", "--count", "HEAD").stdout)

    def test_skill_change_bumps_patch_in_same_commit(self):
        self.write("skills/a/SKILL.md", "b\n")
        self.git("add", "skills")
        self.git("commit", "-q", "-m", "skill")
        self.assertEqual(self.committed_pkg(), PKG.replace("1.2.9", "1.2.10"))
        self.assertEqual(self.git("status", "--porcelain").stdout, "")

    def test_agents_and_rules_changes_bump(self):
        for rel, version in (("agents/x.md", "1.2.10"), ("rules/y.md", "1.2.11")):
            self.write(rel, "x\n")
            self.git("add", rel)
            self.git("commit", "-q", "-m", rel)
            self.assertEqual(self.committed_pkg(), PKG.replace("1.2.9", version))

    def test_crlf_package_json_keeps_line_endings(self):
        crlf = PKG.replace("\n", "\r\n")
        self.write("package.json", crlf)
        self.git("add", "package.json")
        self.git("commit", "-q", "--no-verify", "-m", "crlf")
        self.write("skills/a/SKILL.md", "b\n")
        self.git("add", "skills")
        self.git("commit", "-q", "-m", "skill")
        self.assertEqual(self.committed_pkg(), crlf.replace("1.2.9", "1.2.10"))

    def test_deleting_a_skill_file_bumps(self):
        self.git("rm", "-q", "skills/a/SKILL.md")
        self.git("commit", "-q", "-m", "rm")
        self.assertIn('"version": "1.2.10"', self.committed_pkg())

    def test_unrelated_change_keeps_version(self):
        self.write("README.md", "changed\n")
        self.git("add", "README.md")
        self.git("commit", "-q", "-m", "docs")
        self.assertEqual(self.committed_pkg(), PKG)

    def test_manual_bump_is_not_bumped_again(self):
        self.write("rules/y.md", "y\n")
        self.write("package.json", PKG.replace("1.2.9", "2.0.0"))
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "major")
        self.assertEqual(self.committed_pkg(), PKG.replace("1.2.9", "2.0.0"))

    def test_unstaged_package_json_aborts_commit(self):
        self.write("agents/x.md", "x\n")
        self.git("add", "agents")
        dirty = PKG.replace("demo", "dirty")
        self.write("package.json", dirty)
        staged = self.git("diff", "--cached", "--raw").stdout
        result = self.git("commit", "-q", "-m", "agent", check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("package.json has unstaged changes", result.stderr)
        self.assertEqual(self.commit_count(), 1)
        self.assertEqual((self.repo / "package.json").read_bytes(), dirty.encode())
        self.assertEqual(self.git("diff", "--cached", "--raw").stdout, staged)
        self.assertEqual(self.blob(":package.json"), PKG)


if __name__ == "__main__":
    unittest.main()
