# adversarial-review — Antigravity runtime mapping

Use [SKILL.md](./SKILL.md) for review scoping, preparation, verdict rules, cooldown, and barrier/wave-0 review procedures, and [reviewer.md](./reviewer.md) for the reviewer's instructions. Apply these runtime mappings in Antigravity:

## Tool & path mapping

| OMP (`SKILL.md` / `reviewer.md`) | Antigravity |
| --- | --- |
| `local://<file>` | `<scratch>/<file>` (or `<artifact-dir>/<plan>.md` for plans) |
| `skill://adversarial-review/reviewer.md` | `./reviewer.md` (pass its absolute path to the reviewer) |
| `write agent://<id>` | `send_message` (`Recipient: <conversationId>`) |
| `ask` | `ask_question` |
| `AGENTS.md` | `AGENTS.md` / `GEMINI.md` (if present) |

## Defining the reviewer subagent

Antigravity does not auto-load `agents/*.md` or run OMP's `agent-end` advisor hook. Define a read-only reviewer subagent once per conversation via `define_subagent`:
- `Name`: `"adversarial-reviewer"`
- `EnableWriteTools`: `false`
- `SystemPrompt`: instruct the reviewer to read `./reviewer.md` (using its absolute path) first and follow it strictly (treating `ask` as `ask_question` and checking `AGENTS.md`/`GEMINI.md` if present), or embed `reviewer.md` directly.

Invoke it with `invoke_subagent` (`TypeName: "adversarial-reviewer"`), passing the `SCOPE`, `BASE`, `OUTPUT`, `CHECKS`, `BASELINE_CHECKS`, `PLAN`, `PLAN_DEVIATIONS`, `KNOWN`, and `INTENT` fields from `SKILL.md` as plain text in `Prompt`.

## Model-tier selection

Because `invoke_subagent` exposes tiers (`"inherit"`, `"flash_lite"`, `"flash"`, `"pro"`) rather than cross-family `modelRoles`:
- If implementation slices ran on `"flash"`, run the reviewer on `Model: "pro"` (or `"inherit"` if the coordinator is on a larger tier).
- If the coordinator/author ran on `"pro"` (or `"inherit"`), run the reviewer on `Model: "flash"` (or `"pro"` for critical security/architecture reviews where depth matters more than tier separation).
- When both coordinator-written files (wave-0 spec tests, inline edits, `sonic` text) and `synth`-written files exist, either spawn two reviewers in parallel (each scoped to its own `artifacts:` and the same `OUTPUT` patch) or one reviewer covering the combined scope.
