# AGENTS.md

Concise repo rules for `omp-gated-pipeline`. Keep this file short: it loads on every turn and is read by `synth` and `adversarial-reviewer` on spawn.

## Repo invariants

- **Dual runtime (OMP + Antigravity):** `package.json` and `plugin.json` are both manifests; every skill pairs `skills/<name>/SKILL.md` with `skills/<name>/antigravity.md`, cross-linked in both directions (`tests/test_antigravity_plugin.py` enforces links, frontmatter, and required sections).
- **Zero external dependencies:** Python scripts (`skills/plan-preflight/preflight.py`, `tools/*.py`) use Python 3.10+ stdlib only. `extensions/omp-swarm/` uses Bun/Node built-ins only (no `package.json` dependencies).
- **Version hook:** `.githooks/pre-commit` (kept LF via `.gitattributes`) auto-bumps the patch `version` in both `package.json` and `plugin.json` whenever staged changes touch `skills/`, `agents/`, `rules/`, or `extensions/`. It fails if either manifest has unstaged edits.
- **Lazy test imports in `tests/omp_swarm.test.ts`:** keep per-test dynamic imports of `extensions/omp-swarm/*` so parallel wave-1 slices running `-t` filters do not fail on sibling files.

## Pipeline - omp-gated-pipeline specifics

- **Barrier:** none. Use the no-barrier path in `skill://parallel-fanout`.
- **Integration command** (run from repo root): `bun test tests/ && python -m unittest discover -s tests`
- **Slice acceptance** (run the suite covering owned files):
  - `extensions/omp-swarm/**`: `bun test tests/`
  - `tools/**`, `hooks.json`, `skills/**`, `agents/**`, `rules/**`, `.githooks/**`: `python -m unittest discover -s tests`
  - `AGENTS.md`, `README.md`, `docs/**`: no code test suite (verify any cited commands/paths exist).
- **Test ids:**
  - Bun: title regex (`bun test <test file> -t "<title>"`; e.g. `tests/omp_swarm.test.ts` or `tests/omp_swarm_constellation.test.ts`).
  - Python: dotted unittest id from repo root (`python -m unittest tests.<module>.<Class>.<method>`).
- **Wave-0 red:** run each new spec test alone using the test-id command above. It must fail on an assertion, not on an import, load, or harness error.
- **Skills per file type** (for `synth` rule 8 and `adversarial-reviewer` rule 97):
  - `extensions/omp-swarm/ui.ts`: `skill://modern-web-guidance`, and `skill://color-audit` when adding or changing colors, tokens, or color-coded meaning.
- **Slices must not:** bump `version` in `package.json` or `plugin.json`, add external dependencies (`bun add`, `npm install`, `pip install`), commit or run state-changing git commands, or edit `tests/` outside `owns`.
- **Baseline worktree:** `ovnfs new --name base --rev $BASE`, run the failing command there, then remove it with `ovnfs rm base`.
- **KNOWN sources:** none (no tracked defect docs).
- **Docs-only:** `README.md` and `docs/**` are not read by any code or test. Files under `skills/**`, `agents/**`, `rules/**`, and `hooks.json` are read by `tests/test_antigravity_plugin.py` and are never docs-only.
- **Review conventions:**
  - Changes to `skills/*/SKILL.md` or `rules/gated-pipeline.md`: check parity with `skills/*/antigravity.md` and `tests/test_antigravity_plugin.py`.
  - Changes to `extensions/omp-swarm/ui.ts`: preserve safe HTML/Markdown escaping (no raw HTML injection) and light/dark contrast tokens.
