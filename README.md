# omp-gated-pipeline

omp plugin package: plan → deterministic preflight (0 model tokens) → Sol slices with a Turn 1 feasibility gate → barrier → one adversarial diff audit.

- `rules/gated-pipeline.md`: always-apply main-session rule (fan-out, plan gate, review cooldown).
- `skills/plan-preflight/`: `preflight.py` checks plan paths/symbols (`[NEW]` exempt) and unlisted callers of changed signatures.
- `skills/parallel-fanout/`, `skills/adversarial-review/`: pipeline procedure.
- `agents/synth.md` (Sol; `SPEC_CONFLICT` gate), `agents/critic.md`, `agents/adversarial-reviewer.md` (Opus with a Sol advisor) and `agents/adversarial-reviewer-sol.md` (Sol with an Opus advisor), both loading `skills/adversarial-review/reviewer.md`.

## Install

    omp plugin link /path/to/omp-gated-pipeline
    omp plugin list

Project `.omp/agents`, `.omp/skills`, and user `~/.omp/agent/agents` files with the same names shadow this package; delete them.

## Project contract

Each project's `AGENTS.md` carries a `Pipeline - <project> specifics` section: a barrier command (`--label`, `--expect red`, `--base`, `--full`, `-- <ids>`; writes `.scratch/barrier/<label>.json`) or an integration command for the no-barrier path, test-id format, skip markers, wave-0 red rules, slice-forbidden commands, baseline-worktree setup, KNOWN sources, and review conventions.

## Test

    python -m unittest discover -s tests -v
