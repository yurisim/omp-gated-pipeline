# omp-gated-pipeline

omp plugin package: plan → deterministic preflight (0 model tokens) → task-model slices with a Turn 1 feasibility gate → barrier → one adversarial diff audit.

- `rules/gated-pipeline.md`: always-apply main-session rule: when to plan, fan out, and review.
- `skills/plan-preflight/`: `preflight.py` checks plan paths/symbols (`[NEW]` exempt) and unlisted callers of changed signatures.
- `skills/parallel-fanout/`, `skills/adversarial-review/`: pipeline procedure.
- `agents/synth.md` (task model; `SPEC_CONFLICT` gate), `agents/adversarial-reviewer.md` (coordinator model, task-model advisor) and `agents/adversarial-reviewer-alt.md` (task model, coordinator-model advisor), both loading `skills/adversarial-review/reviewer.md`.

## Install

    omp plugin link /path/to/omp-gated-pipeline
    omp plugin list

Project `.omp/agents`, `.omp/skills`, and user `~/.omp/agent/agents` files with the same names shadow this package; delete them.

## Required omp settings

The reviewer agents' advisor must finish its review before the reviewer returns. Set in `~/.omp/agent/config.yml`:

    advisor:
      enabled: true
      reviewMode: agent-end
      syncBacklog: strict

These also apply to the main session's advisor: one synchronous review per run instead of one per turn. Do not add a `WATCHDOG.yml` advisor roster; any entry replaces the default advisor these settings configure.

## Model roles

The package names no model, only omp model roles (`modelRoles` in `~/.omp/agent/config.yml`). It assumes exactly two models:

| Role | Where it appears | Expected model |
|---|---|---|
| `modelRoles.default` | main session: coordinates, writes wave-0 spec tests and inline edits | coordinator model |
| `modelRoles.plan` | plan-mode session that writes the plan | coordinator model |
| `modelRoles.slow` | `adversarial-reviewer` (`model: "@slow"`); advisor of `adversarial-reviewer-alt` (`advisor: "@slow"`) | coordinator model |
| `modelRoles.task` | `synth` and `adversarial-reviewer-alt` (`model: "@task"`); generic `task` agents; advisor of `adversarial-reviewer` (`advisor: "@task"`) | task model |
| `modelRoles.advisor` | main-session advisor | task model |

Set `default`, `plan` and `slow` to one model, `task` and `advisor` to another, and keep the two groups different: each model reviews what the other wrote. If both groups resolve to the same model, every review is a same-weights self-review.

## Project contract

Each project's `AGENTS.md` carries a `Pipeline - <project> specifics` section: a barrier command (`--label`, `--expect red`, `--base`, `--full`, `-- <ids>`; writes `.scratch/barrier/<label>.json`) or an integration command for the no-barrier path, test-id format, skip markers, wave-0 red rules, slice-forbidden commands, baseline-worktree setup, KNOWN sources, and review conventions.

## Test

    python -m unittest discover -s tests -v
