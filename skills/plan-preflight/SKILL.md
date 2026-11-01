---
name: plan-preflight
description: Zero-token deterministic gate for plan files - path/symbol existence, unlisted callers of changed signatures, and `path:line` anchors in JSON-free serial plans. Run before proposing any plan and before spawning wave 1.
---

# plan-preflight

Run from the repository root (stdlib Python 3.10+; no model call):

    python ~/.omp/plugins/node_modules/omp-gated-pipeline/skills/plan-preflight/preflight.py - < local://<slug>-plan.md

`-` reads the plan from stdin; a file path works too. `--root <dir>` overrides the repo root (default `git rev-parse --show-toplevel`, else cwd).

## Checks

| Code | Fails when |
| --- | --- |
| `BAD_SPEC` | no `## Parallel waves` section, no slice arrays under it (unless the section has a `Serial:` line and an `Acceptance:` line, the JSON-free serial form), a JSON-free `Serial:` section with no `Acceptance:` line, invalid JSON in a wave block, a slice missing or mistyping `id`/`agent`/`owns`/`reads`/`symbols`/`invariants`/`tests`/`acceptance`, or a duplicate id |
| `PATH_MISSING` | an untagged `owns`/`reads`/`symbols[].path` entry, or a serial-plan anchor's file, does not exist |
| `SYMBOL_MISSING` | a segment of an untagged symbol `name` (split on `.`, `#`, `:`) does not appear as a word in its file, or a symbol written beside a serial-plan anchor is not a word in that file |
| `LINE_OUT_OF_RANGE` | a serial-plan anchor names line 0, or its highest line number is past the end of its file |
| `UNLISTED_CALLER` | a symbol's `signature` is not in its file verbatim (whitespace-normalized), so the plan changes it, and a file referencing its last name segment (`git grep -w`) is in no slice's `owns`, `reads`, `symbols[].path`, or `tests` file |

## Tagging

- Paths and symbols the plan creates start with `[NEW] `: `"[NEW] src/app/x.ts"`, `"name": "[NEW] parseWave"`. A path tagged anywhere counts as new everywhere.

## Anchors (JSON-free serial plans)

A JSON-free serial plan has no slice JSON, so preflight checks the code locations its prose cites:

- An anchor is a single-backtick inline code span outside fenced blocks whose whole content is `<file>.<ext>:<lines>`. The file name needs a dot and an extension that starts with a letter, so `Dockerfile:9` and `127.0.0.1:9222` are not anchors. `<lines>` is `N`, `N-M`, or a comma list of those, for example `src/app/x.ts:40-72` or `x.ts:24-29,151`. Lines start at 1.
- Resolution: an absolute, drive-letter or `~` path is checked as that one file. A relative path resolves from the repo root, else as a path suffix of any repo file (`ui/panel.py:10` matches `src/pkg/ui/panel.py`). A path without `/` that matches no file is not an anchor, so `api.example.com:8080` is ignored; a path with `/` that matches nothing is `PATH_MISSING`.
- Symbols are the single-backtick spans that directly follow an anchor on the same line, separated only by spaces, commas or `/`, for example `` `x.ts:40-72` `parse`/`Wave.run()` ``. Each identifier (a trailing `()` is dropped, then split on `.`) must appear as a word in the file. Spans that name an existing file, or are not identifiers (`ASK_AT = 50`), are skipped; any other text ends the run.
- Plans with slice JSON get no anchor checks; their `owns`, `reads` and `symbols` are checked instead.

## Output and handling

JSON on stdout: `verdict`, `root`, `slices`, `anchors`, `diagnostics` (`code`, `slice`, `line`, `detail`), `elapsed_ms`. Exit 0 pass, 1 fail, 2 usage error.

- `pass`: proceed (propose, or spawn wave 1) with zero extra model turns. A pass with `slices: 0` is the JSON-free serial form: only its anchors were checked, and `anchors` counts them; `anchors: 0` means nothing was checked.
- `fail`: fix exactly the reported diagnostics in the plan, never the code, and rerun. After 3 failing runs, `ask` the user with the remaining diagnostics.
- Exit 2 or output that is not JSON: fix the invocation. Never treat it as a pass.
