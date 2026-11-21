# omp-gated-pipeline

omp plugin package: plan → deterministic preflight (0 model tokens) → task-model slices with a Turn 1 feasibility gate → barrier → one adversarial diff audit.

- `rules/gated-pipeline.md`: always-apply main-session rule: when to plan, fan out, and review.
- `skills/plan-preflight/`: `preflight.py` checks plan paths/symbols (`[NEW]` exempt) and unlisted callers of changed signatures.
- `skills/parallel-fanout/`, `skills/adversarial-review/`: pipeline procedure.
- `agents/synth.md` (task model; `SPEC_CONFLICT` gate), `agents/adversarial-reviewer.md` and `agents/adversarial-reviewer-alt.md`, both loading `skills/adversarial-review/reviewer.md`.

## Goals

- **Secure:** code, script, test and build-config changes are reviewed by a model from the other family than the one that wrote them, so no model grades its own work (docs-only and typo edits skip review). Each file has one author per run, so review routing stays unambiguous.
- **Fast:** checks that need no model run as scripts (plan preflight, barrier). The expensive coordinator model plans, gates and reviews; the cheaper task model writes most of the code.
- **Parallel:** plans are split into slices with disjoint files and fixed contracts, and each wave of slices runs at once.
- **Measured:** `tools/session_metrics.py` reads omp session transcripts and reports, for each run that spawns `synth`, cost per role, coordinator turns per slice, lines written by role, empty waits and review findings, so each change to the procedure can be compared with earlier runs. JSON-free serial runs spawn no `synth` and are not counted.

## Install

Requires omp, git and Python 3.10+ on `PATH` (the preflight and metrics scripts use only the standard library).

1. Clone and link the package:

       git clone https://github.com/yurisim/omp-gated-pipeline.git
       omp plugin link /path/to/omp-gated-pipeline

2. Check that it loaded:

       omp plugin list      # shows omp-gated-pipeline@<version>
       omp plugin doctor    # 0 warnings, 0 errors

3. Apply the omp settings in [Required omp settings](#required-omp-settings) and [Model roles](#model-roles).
4. In each project that uses the pipeline, add the `AGENTS.md` section described in [Project contract](#project-contract).

Project `.omp/agents`, `.omp/skills`, and user `~/.omp/agent/agents` files with the same names shadow this package; delete them.

To work on the package itself, enable the version-bump hook: `git config core.hooksPath .githooks`. It bumps the patch version in `package.json` on every commit that touches `skills/`, `agents/` or `rules/`.

Measure pipeline runs:

    python tools/session_metrics.py --since 2026-11-21 [--project <text>] [--json]

## Install (Antigravity)

The repository root includes `plugin.json`, so Antigravity can load the same `skills/` and `rules/` directly (each skill pairs its OMP `SKILL.md` with an `antigravity.md` runtime adapter).

1. **Full plugin (recommended — loads both `rules/` and `skills/`):** clone the repo and either link it into `~/.gemini/config/plugins/omp-gated-pipeline` (symlink on Unix/macOS, or directory junction on Windows PowerShell: `New-Item -ItemType Junction -Path "$HOME\.gemini\config\plugins\omp-gated-pipeline" -Target "<repo-path>"`), or register it in `~/.gemini/config/plugins.json` using an absolute or `~/...` home-relative path:

       {
         "entries": [
           { "path": "~/projects", "include_only": ["omp-gated-pipeline"] }
         ]
       }

   Note: `agy plugin validate .` loads `skills: 3` and `rules: 1` while skipping OMP's `agents/*.md` files (which Antigravity registers at runtime via `define_subagent`).

2. **Skills only (no always-on rule):** register the `skills/` directory in `~/.gemini/config/skills.json`:

       {
         "entries": [
           { "path": "/path/to/omp-gated-pipeline/skills" }
         ]
       }

3. Delete any manually copied `plan-preflight`, `parallel-fanout`, or `adversarial-review` directories under `~/.gemini/config/skills/` so they do not shadow the plugin.

Antigravity does not run OMP's `agent-end` advisor hook or `modelRoles`; each skill's `antigravity.md` maps subagent creation (`define_subagent` using `agents/synth.md` and `skills/adversarial-review/reviewer.md`), parallel dispatch (`invoke_subagent`), messaging (`send_message`), user prompts (`ask_question`), and model-tier separation (`flash` vs `pro`/`inherit`, or explicit model pinning when using `/swarm`).

## Required omp settings

The reviewer agents' advisor must finish its review before the reviewer returns. Set in `~/.omp/agent/config.yml`:

    advisor:
      enabled: true
      reviewMode: agent-end
      syncBacklog: strict

These also apply to the main session's advisor. Do not add a `WATCHDOG.yml` advisor roster; any entry replaces the default advisor these settings configure.

## Model roles

The package names no model, only omp model roles (`modelRoles` in `~/.omp/agent/config.yml`). It assumes exactly two models:

| Role | Where it appears | Expected model |
|---|---|---|
| `modelRoles.default` | main session: coordinates, writes wave-0 spec tests and inline edits | coordinator model |
| `modelRoles.plan` | plan-mode session that writes the plan | coordinator model |
| `modelRoles.slow` | `adversarial-reviewer` (`model: "@slow"`); advisor of `adversarial-reviewer-alt` (`advisor: "@slow"`) | coordinator model |
| `modelRoles.task` | `synth` and `adversarial-reviewer-alt` (`model: "@task"`); generic `task` agents; advisor of `adversarial-reviewer` (`advisor: "@task"`) | task model |
| `modelRoles.advisor` | main-session advisor | task model |

Set `default`, `plan` and `slow` to one model, `task` and `advisor` to another, and keep the two groups different: each model reviews what the other wrote.

## Project contract

Each project's `AGENTS.md` carries a `Pipeline - <project> specifics` section: a barrier command (`--label`, `--expect red`, `--base`, `--full`, `-- <ids>`; writes `.scratch/barrier/<label>.json`) or an integration command for the no-barrier path, test-id format, skip markers, wave-0 red rules, slice-forbidden commands, baseline-worktree setup, KNOWN sources, and review conventions.

## Test

    python -m unittest discover -s tests -v
