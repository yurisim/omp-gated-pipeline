---
name: plan-preflight
description: Zero-token deterministic gate for plan files - path/symbol existence and unlisted callers of changed signatures. Run before proposing any plan and before spawning wave 1.
---

# plan-preflight

Run from the repository root (stdlib Python 3.10+; no model call):

    python ~/.omp/plugins/node_modules/omp-gated-pipeline/skills/plan-preflight/preflight.py - < local://<slug>-plan.md

`-` reads the plan from stdin; a file path works too. `--root <dir>` overrides the repo root (default `git rev-parse --show-toplevel`, else cwd).

## Checks

| Code | Fails when |
| --- | --- |
| `BAD_SPEC` | no `## Parallel waves` section, no slice arrays under it, invalid JSON in a wave block, a slice missing or mistyping `id`/`agent`/`owns`/`reads`/`symbols`/`invariants`/`tests`/`acceptance`, or a duplicate id |
| `PATH_MISSING` | an untagged `owns`/`reads`/`symbols[].path` entry does not exist |
| `SYMBOL_MISSING` | a segment of an untagged symbol `name` (split on `.`, `#`, `:`) does not appear as a word in its file |
| `UNLISTED_CALLER` | a symbol's `signature` is not in its file verbatim (whitespace-normalized), so the plan changes it, and a file referencing its last name segment (`git grep -w`) is in no slice's `owns`, `reads`, `symbols[].path`, or `tests` file |

## Tagging

- Paths and symbols the plan creates start with `[NEW] `: `"[NEW] src/app/x.ts"`, `"name": "[NEW] parseWave"`. A path tagged anywhere counts as new everywhere.

## Output and handling

JSON on stdout: `verdict`, `root`, `slices`, `diagnostics` (`code`, `slice`, `line`, `detail`), `elapsed_ms`. Exit 0 pass, 1 fail, 2 usage error.

- `pass`: proceed (propose, or spawn wave 1) with zero extra model turns.
- `fail`: fix exactly the reported diagnostics in the plan, never the code, and rerun. After 3 failing runs, `ask` the user with the remaining diagnostics.
- Exit 2 or output that is not JSON: fix the invocation. Never treat it as a pass.
