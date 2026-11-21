# parallel-fanout — Antigravity runtime mapping

Use [SKILL.md](./SKILL.md) for all planning, slicing, barrier, ownership, and gating rules. Apply these runtime mappings in Antigravity:

## Tool & path mapping

| OMP (`SKILL.md`) | Antigravity |
| --- | --- |
| `local://<file>` | `<scratch>/<file>` (or `<artifact-dir>/<plan>.md` for plans) |
| `skill://<name>` | Skill `<name>` (read both `SKILL.md` and `antigravity.md`) |
| `task` batch (`tasks[]`) | Parallel `invoke_subagent` calls in the same turn; end the turn without polling (Antigravity wakes you automatically) |
| `write agent://<id>` | `send_message` (`Recipient: <conversationId>`) |
| `ask` | `ask_question` |
| `scout` (planning research) | Built-in `research` subagent |
| `BASE=$(git stash create)` | On Windows PowerShell: `$BASE = git stash create; if (-not $BASE) { $BASE = git rev-parse HEAD }` |

## Defining `synth` (once per conversation)

Antigravity does not auto-load `agents/*.md` from plugins. Before spawning Wave 1, read `../../agents/synth.md` (relative to this directory), strip its YAML frontmatter, and call `define_subagent` with:
- `Name`: `"synth"`
- `EnableWriteTools`: `true`
- `SystemPrompt`: the body of `../../agents/synth.md`, plus these Antigravity notes:
  - Read `AGENTS.md` / `GEMINI.md` if present.
  - Return your final response as a JSON object with keys `edits`, `lines`, `planDeviations`, `checks`, and `specConflict` (matching the schema in `agents/synth.md`'s frontmatter).
  - Treat `send_message` messages from the coordinator as coordinator messages under Rule 7.

For `sonic` slices (non-code edits with exact text), apply them inline as coordinator-owned edits, or use a minimal write-enabled subagent with `Model: "flash"`. Never use `TypeName: "self"`: it re-runs the full coordinator configuration and always-on rules.

## Workspace isolation

For parallel `synth` waves that run builds or tests, pass `Workspace: "share"` to `invoke_subagent` so each slice gets its own working copy and slices don't collide on the working tree or `.scratch/barrier`. Land each slice's changes into the main working copy before the integration gate. Keep `inherit` when files and build outputs are strictly disjoint.

## Model separation

- When `exit_plan_mode` has already handed a 1-slice or serial plan to the execution model, execute it inline instead of spawning `synth`. Use fan-out for 2+ slices or when wave-0/barrier gates apply.
- `invoke_subagent` accepts generic tiers (`"inherit"`, `"flash_lite"`, `"flash"`, `"pro"`), not exact model IDs. Use `Model: "flash"` for `synth` slices when the coordinator runs on a larger tier, or `"inherit"` otherwise.
- When the user explicitly invokes `/swarm`, `swarm{action: "add", model: ...}` can pin workers to exact model names (e.g. planning in one model family and executing in another).

## Quota / 429 fallback

Outside an explicit `/swarm` invocation or the 429 fallback below, never call `swarm`.

When any `invoke_subagent` or `send_message` call fails with `RESOURCE_EXHAUSTED` (429):
1. Immediately call `swarm{action: "models", all: true}` to inspect per-model `quotas` (`quota_remaining`, `quota_resets`).
2. If every model reports `0%` `quota_remaining`, stop and call `ask_question` with the earliest `quota_resets` timestamp; never fall back to inline coordinator edits on `synth`-owned files.
3. Otherwise, select a healthy non-zero-quota model (preferring a single consistent model line across replacement `synth` workers, e.g. `gemini-4-hydrogen-medium`) and spawn a replacement worker via `swarm{action: "add", model: <chosen>, workspace: ...}` whose brief embeds the `../../agents/synth.md` body (Turn 1 `SPEC_CONFLICT` gate, `owns`/test-protection rules, JSON output keys `edits`, `lines`, `planDeviations`, `checks`, `specConflict`) alongside the slice's `owns`, `reads`, `AGENTS.md`, barrier/acceptance rules, the pending task or owner-edit fix brief, and an instruction to post its result to `@coordinator` on the board.
4. Update `OWNERS` to the replacement worker's roster name, record the fallback in `planDeviations`, and kill all fallback workers via `swarm{action: "kill"}` once the final integration/audit gate passes.
