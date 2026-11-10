# Version auto-increment hook

## Context

Request: "install these skills and autoincrement". The package is already installed in omp as a link (`~/.omp/plugins/node_modules/omp-gated-pipeline` → `C:\Users\yuras\projects\omp-gated-pipeline`; `omp plugin list` shows `omp-gated-pipeline@1.2.4`, `omp plugin doctor` 0 errors), so omp always loads the current files. The user chose: keep the link and only verify it; add a git pre-commit hook that bumps the patch version in `package.json` whenever a commit touches `skills/`, `agents/` or `rules/`. End state: a tracked `.githooks/pre-commit`, enabled in this clone through `core.hooksPath`, covered by a test.

Observed state: working tree clean at `fa791c5`; `.git/hooks` holds only `.sample` files; `core.hooksPath` is unset; `package.json` line 3 is `  "version": "1.2.4",`; no `AGENTS.md`, so this is a no-barrier project and the integration command is `python -m unittest discover -s tests -v` (README "Test").

## Approach

1. **Spec test (wave 0, coordinator).** Create `tests/test_version_hook.py` with the exact content under "Wave 0". It builds a throwaway git repo per test, copies `.githooks/pre-commit` into it, and commits through real `git`. It fails until step 2 lands (the hook file does not exist).

2. **Hook (wave 1, `synth`).** Create `.githooks/pre-commit`, a POSIX `sh` script (`#!/bin/sh`, LF line endings) using only `git`, `sed` and shell built-ins: no python, node or jq. No existing bump script or hook exists in the repo to reuse. Behavior, in this order:
   1. If `git diff --cached --name-only --diff-filter=ACDMR -- skills agents rules` prints nothing, exit 0 without touching anything.
   2. Read the staged version: the `MAJOR.MINOR.PATCH` (digits only) from the line `"version": "…"` of `git show :package.json`. If `package.json` is not staged/tracked or has no such line, print `pre-commit: no semver "version" in package.json` to stderr and exit 1.
   3. Read the `HEAD` version the same way from `git show HEAD:package.json` (empty when there is no `HEAD` or no match). If it differs from the staged version, the commit already carries a manual bump: exit 0 without changes.
   4. If `git diff --quiet -- package.json` reports unstaged changes, print `pre-commit: package.json has unstaged changes; stage or stash them so the version bump can be committed` to stderr and exit 1. The commit is aborted; nothing is modified.
   5. Otherwise compute `MAJOR.MINOR.(PATCH+1)` numerically (`1.2.9` → `1.2.10`), rewrite only that version string in the working-tree `package.json` (every other byte, including line endings, unchanged), run `git add package.json`, print `pre-commit: version <old> -> <new>` to stderr, exit 0.

   `git commit --amend` reruns the hook and bumps again; that is accepted (use `--no-verify` when amending). Do not add amend detection.

3. **Enable and verify (coordinator, after the slice gate passes).** From the repo root:
   - `git add --chmod=+x .githooks/pre-commit` and `git add tests/test_version_hook.py` (hook must be mode 100755 for non-Windows clones; staging only, no commit).
   - `git config core.hooksPath .githooks`
   - `omp plugin list` and `omp plugin doctor` (install check; the link is kept, nothing is reinstalled).

   Do not bump `package.json` by hand: this change touches none of `skills/`, `agents/`, `rules/`, so the version stays `1.2.4`.

## Parallel waves

Serial: one code slice; its spec test must exist first.

### Wave 0

Coordinator writes `tests/test_version_hook.py` verbatim:

```python
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

    def committed_pkg(self):
        return self.git("show", "HEAD:package.json").stdout

    def commit_count(self):
        return int(self.git("rev-list", "--count", "HEAD").stdout)

    def test_skill_change_bumps_patch_in_same_commit(self):
        self.write("skills/a/SKILL.md", "b\n")
        self.git("add", "skills")
        self.git("commit", "-q", "-m", "skill")
        self.assertEqual(self.committed_pkg(), PKG.replace("1.2.9", "1.2.10"))
        self.assertEqual(self.git("status", "--porcelain").stdout, "")

    def test_agents_and_rules_changes_bump(self):
        for rel in ("agents/x.md", "rules/y.md"):
            self.write(rel, "x\n")
            self.git("add", rel)
            self.git("commit", "-q", "-m", rel)
        self.assertIn('"version": "1.2.11"', self.committed_pkg())

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
        result = self.git("commit", "-q", "-m", "agent", check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("package.json has unstaged changes", result.stderr)
        self.assertEqual(self.commit_count(), 1)
        self.assertEqual((self.repo / "package.json").read_bytes(), dirty.encode())


if __name__ == "__main__":
    unittest.main()
```

No barrier: no `wave0-red` run. Expected before wave 1: `python -m unittest tests.test_version_hook` errors in `setUp` (`FileNotFoundError` for `.githooks/pre-commit`).

### Wave 1

```json
[
  {
    "id": "S1",
    "agent": "synth",
    "owns": ["[NEW] .githooks/pre-commit"],
    "reads": ["package.json", "[NEW] tests/test_version_hook.py"],
    "symbols": [],
    "invariants": [
      "POSIX sh script starting with #!/bin/sh, LF line endings; uses only git, sed and shell built-ins (no python, node, jq)",
      "Exit 0 with no changes when `git diff --cached --name-only --diff-filter=ACDMR -- skills agents rules` is empty",
      "Staged version = MAJOR.MINOR.PATCH digits from the `\"version\": \"...\"` line of `git show :package.json`; missing file or line: stderr `pre-commit: no semver \"version\" in package.json`, exit 1",
      "HEAD version read the same way from `git show HEAD:package.json` (empty when absent); if it differs from the staged version, exit 0 with no changes",
      "If `git diff --quiet -- package.json` reports unstaged changes: stderr `pre-commit: package.json has unstaged changes; stage or stash them so the version bump can be committed`, exit 1, nothing modified",
      "Otherwise rewrite only the version string in the working-tree package.json to MAJOR.MINOR.(PATCH+1) computed numerically (1.2.9 -> 1.2.10), every other byte unchanged, run `git add package.json`, print `pre-commit: version <old> -> <new>` to stderr, exit 0",
      "No amend detection; do not edit tests/test_version_hook.py or package.json in the repo"
    ],
    "tests": [],
    "acceptance": "python -m unittest tests.test_version_hook -v"
  }
]
```

Integration command (no barrier): `python -m unittest discover -s tests -v`.

## Critical files & anchors

- `package.json:3`: the `"version"` line the hook rewrites; 2-space indent, trailing comma.
- `tests/test_preflight.py`: existing `unittest` style to match (run with `python -m unittest discover -s tests -v`).

## Verification

Run from the repo root, after step 3:

1. `python -m unittest tests.test_version_hook -v` → 6 tests pass (bump on `skills/`, `agents/`, `rules/`, deletion; no bump on README-only; manual bump kept; unstaged `package.json` aborts).
2. `python -m unittest discover -s tests -v` → all tests pass, including the existing preflight tests.
3. `git config --get core.hooksPath` → `.githooks`; `git ls-files -s .githooks/pre-commit` → mode `100755`.
4. `omp plugin list` → `omp-gated-pipeline@1.2.4`; `omp plugin doctor` → 0 warnings, 0 errors.
5. `git diff HEAD -- package.json` → empty (no bump from this change).

## Assumptions & contingencies

- No commit is made; files are left staged/untracked for the user. If the user commits this change, the version stays `1.2.4` because no `skills/`, `agents/` or `rules/` file changed.
- `core.hooksPath` is per-clone configuration; other clones must run `git config core.hooksPath .githooks` themselves.
- If hooks do not run under `git` in the test (commit succeeds with the version unchanged on Windows), check `git --version` and that `sh` ships with Git for Windows; do not replace the hook with a Python script without asking the user.
