# parallel-fanout — Antigravity runtime mapping

Use [SKILL.md](./SKILL.md) for all planning, slicing, barrier, ownership, and gating rules. Apply these runtime mappings in Antigravity:

## Tool & path mapping

| OMP (`SKILL.md`) | Antigravity |
| --- | --- |
| `local://<file>` | `<scratch>/<file>` (or `<artifact-dir>/<plan>.md` for plans) |
| `skill://<name>` | Skill `<name>` (read both `SKILL.md` and `antigravity.md`) |
| `task` batch (`tasks[]`) | Preferred for implementation waves (2+ slices): parallel `swarm{action: "add"}` workers (read `swarm_pane` before adding the first workers, embed `../../agents/synth.md` in each brief, and end the turn without polling). Fallback (or for single-slice / read-only `scout` batches): parallel `invoke_subagent` calls |
| `write agent://<id>` | For swarm workers: `post_message` mentioning `@<worker-name>` (never `kill` and re-`add` for owner edits). For subagents: `send_message` (`Recipient: <conversationId>`) |
| `ask` | `ask_question` |
| `scout` (planning research) | Built-in `research` subagent via parallel `invoke_subagent` calls |
| `BASE=$(git stash create)` | On Windows PowerShell: `$BASE = git stash create; if (-not $BASE) { $BASE = git rev-parse HEAD }` |
| `agent://<reviewer id>` or `local://` file cited in a message | For swarm workers: the board post number (`#<seq>`) of a report already posted; evidence that exists only as a file keeps its `<scratch>/<file>` path and item id. For subagents: the `<scratch>/<file>` path of the saved report |
| Section 3 "Stall check" and "Isolated wave (trial)" | Not used here: follow "Swarm reliability" and "Workspace isolation" below |

## Swarm execution (preferred for multi-slice implementation waves)

For any implementation wave with 2+ slices (or whenever model pinning / Swarm UI visibility is helpful), prefer `swarm` over `invoke_subagent`:
1. Load the `swarm_pane` skill and call `swarm{action: "title", title: ...}` before adding the first workers.
2. Call `swarm{action: "models", all: true}` if you need to pick a specific healthy model line; otherwise omit `model` to inherit your own model or pin a faster worker model consistently across the wave.
3. Spawn one worker per slice in parallel via `swarm{action: "add", name: "<slice-id-lowercase>", workspace: ...}`, embedding the body of `../../agents/synth.md` (Turn 1 `SPEC_CONFLICT` gate, `owns`/test-protection rules, JSON output keys `edits`, `lines`, `planDeviations`, `checks`, `specConflict`) alongside the slice JSON, `BASE`, `AGENTS.md` pointer, and acceptance/barrier rules.
4. Keep `OWNERS` mapped to each worker's roster name for owner-edit follow-ups via `@<worker>` board posts, and call `swarm{action: "kill"}` on finished workers only after the final integration and adversarial-review gates pass (so owner edits never hit a killed worker).

## Defining `synth` (subagent fallback)

When using `invoke_subagent` instead of `swarm`, Antigravity does not auto-load `agents/*.md` from plugins. Before spawning Wave 1, read `../../agents/synth.md` (relative to this directory), strip its YAML frontmatter, and call `define_subagent` with:
- `Name`: `"synth"`
- `EnableWriteTools`: `true`
- `SystemPrompt`: the body of `../../agents/synth.md`, plus these Antigravity notes:
  - Read `AGENTS.md` / `GEMINI.md` if present.
  - Return your final response as a JSON object with keys `edits`, `lines`, `planDeviations`, `checks`, and `specConflict` (matching the schema in `agents/synth.md`'s frontmatter).
  - Treat `send_message` messages from the coordinator as coordinator messages under Rule 7.

For `sonic` slices (non-code edits with exact text), apply them inline as coordinator-owned edits, or use a minimal write-enabled subagent with `Model: "flash"`. Never use `TypeName: "self"`: it re-runs the full coordinator configuration and always-on rules.

## Workspace isolation

For parallel `synth` waves that run builds or tests, pass `workspace: "share"` (`Workspace: "share"` for subagents) so each slice gets its own working copy and slices don't collide on the working tree or `.scratch/barrier`. Land each slice's changes into the main working copy before the integration gate. Keep `inherit` when files and build outputs are strictly disjoint (or when slices build on pre-existing uncommitted working-tree edits).

## Model separation

- When `exit_plan_mode` has already handed a 1-slice or serial plan to the execution model, execute it inline instead of spawning workers. Use fan-out for 2+ slices or when wave-0/barrier gates apply.
- With `swarm`, `swarm{action: "add", model: ...}` pins workers to exact model names (enabling true cross-family separation between implementation workers and the adversarial reviewer).
- With `invoke_subagent`, generic tiers (`"inherit"`, `"flash_lite"`, `"flash"`, `"pro"`) apply; use `Model: "flash"` for `synth` slices when the coordinator runs on a larger tier, or `"inherit"` otherwise.

## Swarm reliability

Whenever running `swarm` workers:
- **Mandatory completion post**: Every worker brief must end with: *"Before ending your turn, you MUST call `post_message` mentioning `@coordinator` — never go `waiting` silently."*
- **Check roster before sleeping**: Before calling `swarm_wait`, check `swarm{action: "status"}`. If a worker is already `waiting` with no completion post, inspect its owned files/checks directly (or nudge it) instead of sleeping.
- **Bounded wait**: When waiting on 2+ active swarm workers, avoid unbounded `swarm_wait` alone — pair with a one-shot watchdog (`schedule{DurationSeconds: 180, TimerCondition: "any"}`) so silently parked or stalled workers are caught automatically.
- **Reserved names**: Killed worker names stay reserved for the swarm's lifetime; always use a fresh suffixed name (e.g. `s2-actions-2`) when replacing a failed or killed worker.

## Quota / 429 fallback

When any worker or subagent hits `RESOURCE_EXHAUSTED` (429):
1. Immediately call `swarm{action: "models", all: true}` to inspect per-model `quotas` (`quota_remaining`, `quota_resets`).
2. If every model reports `0%` `quota_remaining`, stop and call `ask_question` with the earliest `quota_resets` timestamp; never fall back to inline coordinator edits on `synth`-owned files.
3. Otherwise, select a healthy non-zero-quota model (preferring a single consistent model line across workers): for an existing `waiting` swarm worker, switch it via `swarm{action: "model", name: <worker>, model: <chosen>}`; for a failed subagent, spawn a replacement swarm worker via `swarm{action: "add", model: <chosen>, workspace: ...}` embedding `../../agents/synth.md` and the slice brief.
4. Update `OWNERS` if a new worker was spawned, record the fallback in `planDeviations`, and kill all workers via `swarm{action: "kill"}` once the final integration/audit gate passes.
