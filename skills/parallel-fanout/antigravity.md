# parallel-fanout — Antigravity runtime mapping

Use [SKILL.md](./SKILL.md) for all planning, slicing, barrier, ownership, and gating rules. Apply these runtime mappings in Antigravity:

## Tool & path mapping

| OMP (`SKILL.md`) | Antigravity |
| --- | --- |
| `local://<file>` | `<scratch>/<file>` (or `<artifact-dir>/<plan>.md` for plans) |
| `skill://<name>` | Skill `<name>` (read both `SKILL.md` and `antigravity.md`) |
| `task` batch (`tasks[]`) | Parallel `swarm` workers for implementation waves; parallel `invoke_subagent` calls for fallback, single slices, or read-only `scout` batches |
| `write agent://<id>` | For swarm workers: `post_message` mentioning `@<worker-name>`; for subagents: `send_message` (`Recipient: <conversationId>`) |
| `ask` | `ask_question` |
| `scout` (planning research) | Built-in `research` subagent via parallel `invoke_subagent` calls |
| `BASE=$(git stash create)` | On Windows PowerShell: `$BASE = git stash create; if (-not $BASE) { $BASE = git rev-parse HEAD }` |
| `agent://<reviewer id>` or `local://` file cited in a message | For swarm workers: the board post number (`#<seq>`) of a report already posted; evidence that exists only as a file keeps its `<scratch>/<file>` path and item id. For subagents: the `<scratch>/<file>` path of the saved report |
| Section 3 "Stall check" and "Isolated wave (trial)" | Not used here: follow "Swarm reliability" and "Workspace isolation" below |

## Swarm execution (preferred for multi-slice implementation waves)

Prefer `swarm` for 2+ implementation slices or when model pinning or Swarm UI visibility helps.
1. Load `swarm_pane` and set `swarm{action: "title", title: ...}` before adding workers.
2. Spawn one worker per slice in parallel via `swarm{action: "add", name: "<slice-id-lowercase>", workspace: ...}` with the corresponding brief below; end the turn without polling.
3. Keep `OWNERS` mapped to worker roster names for owner edits. Use `swarm{action: "kill"}` on finished workers only after the final integration and adversarial-review gates pass.

## Worker briefs and subagent fallback

For `synth`, use the body of `../../agents/synth.md` (omit YAML frontmatter), preserving Turn 1 `SPEC_CONFLICT`, `owns`, and test protection. Instruct workers to return a JSON object with keys `edits`, `lines`, `planDeviations`, `checks`, and `specConflict`. Pass slice JSON, `BASE`, the `AGENTS.md` pointer, and acceptance/barrier rules.

Embed the body in swarm briefs. For `invoke_subagent`, which does not auto-load plugin agents, call `define_subagent` before Wave 1:
- `Name`: `"synth"`
- `EnableWriteTools`: `true`
- `SystemPrompt`: the `synth` body, plus:
  - Read `AGENTS.md` / `GEMINI.md` if present.
  - Treat `send_message` messages from the coordinator as coordinator messages under Rule 7.

For `sonic`, use a minimal write-enabled brief with the exact text edits, not the `synth` body. Use `Model: "flash"` for a `sonic` subagent. Never use `TypeName: "self"`: it reloads the coordinator's configuration and rules.

## Workspace isolation

For parallel `synth` waves that run builds or tests, pass `workspace: "share"` (`Workspace: "share"` for subagents) so each slice gets its own working copy and slices don't collide on the working tree or `.scratch/barrier`. Land each slice's changes into the main working copy before the integration gate. Keep `inherit` when files and build outputs are strictly disjoint (or when slices build on pre-existing uncommitted working-tree edits).

## Model separation

- After `exit_plan_mode`, execute inline only for a JSON-free or otherwise exempt single-slice handoff; run other slices through the prescribed gates.
- With `swarm`, omit `model` to inherit, or pin a consistent worker model by exact name (see catalog lookup below) for cross-family review.
- With `invoke_subagent`, generic tiers (`"inherit"`, `"flash_lite"`, `"flash"`, `"pro"`) apply; use `Model: "flash"` for `synth` slices when the coordinator runs on a larger tier, or `"inherit"` otherwise.

## Swarm reliability

Whenever running `swarm` workers:
- **Mandatory completion post**: Every worker brief must end with: *"Before ending your turn, you MUST call `post_message` mentioning `@coordinator` — never go `waiting` silently."*
- **Check roster before sleeping**: Before calling `swarm_wait`, check `swarm{action: "status"}`. If a worker is already `waiting` with no completion post, inspect its owned files/checks directly (or nudge it) instead of sleeping.
- **Bounded wait**: When waiting on 2+ active swarm workers, avoid unbounded `swarm_wait` alone — pair with a one-shot watchdog (`schedule{DurationSeconds: 180, TimerCondition: "any"}`) so silently parked or stalled workers are caught automatically.
- **Reserved names**: Killed worker names stay reserved for the swarm's lifetime; always use a fresh suffixed name (e.g. `s2-actions-2`) when replacing a failed or killed worker.

## Quota / 429 fallback

Call `swarm{action: "models", all: true}` when selecting a model or immediately after `RESOURCE_EXHAUSTED` (429). For quota recovery:
1. Inspect per-model `quotas` (`quota_remaining`, `quota_resets`).
2. If every model reports `0%` `quota_remaining`, stop and call `ask_question` with the earliest `quota_resets` timestamp; never fall back to inline coordinator edits on `synth`-owned files.
3. Otherwise, choose a healthy non-zero-quota model, preferably on one consistent worker line. Switch a `waiting` swarm worker via `swarm{action: "model", name: <worker>, model: <chosen>}`; replace a failed subagent with a swarm worker using the corresponding brief above.
4. Update `OWNERS` for replacements and record the fallback in `planDeviations`.
