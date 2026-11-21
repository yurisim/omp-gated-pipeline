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
| `todo` | Optional `task.md` artifact |
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

For `sonic` slices (non-code edits with exact text), use `invoke_subagent` with `TypeName: "self"` (or a write-enabled subagent).

## Model separation

- `invoke_subagent` accepts generic tiers (`"inherit"`, `"flash_lite"`, `"flash"`, `"pro"`), not exact model IDs. Use `Model: "flash"` for `synth` slices when the coordinator runs on a larger tier, or `"inherit"` otherwise.
- When the user explicitly invokes `/swarm`, `swarm{action: "add", model: ...}` can pin workers to exact model names (e.g. planning in one model family and executing in another). Never call `swarm` unless the user explicitly invoked `/swarm`.
