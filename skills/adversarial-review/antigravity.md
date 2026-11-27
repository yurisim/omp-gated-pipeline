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

For either runtime, pass `SCOPE`, `BASE`, `OUTPUT`, `CHECKS`, `BASELINE_CHECKS`, `PLAN`, `PLAN_DEVIATIONS`, `KNOWN`, and `INTENT`.

## Cross-family review via `swarm` (preferred)

Prefer `swarm` so the reviewer can run on a different model family/line than the author:
1. Call `swarm{action: "models", all: true}` and choose a healthy non-zero-quota model from a different family/line than the implementation author.
2. Spawn a read-only worker via `swarm{action: "add", name: "reviewer", model: <chosen>, workspace: "inherit"}`. In the brief, give the absolute path to `reviewer.md`; instruct the worker to follow it strictly (no edits, shell commands, or subagents) and report via `post_message` mentioning `@coordinator` before ending its turn.
3. Use `swarm{action: "kill"}` on startup failure, on stall, or after handling the verdict:
   - **Unmapped catalog keys**: The catalog can list unavailable backend keys (`unknown model key ...: model not found`). On startup failure, switch to another verified model line with a fresh name (e.g. `reviewer-2`) or use subagent fallback.
   - **Stall fallback**: If the reviewer stays `working` for >3 minutes without a board post, use subagent fallback.
   - **Focused untracked scope**: For greenfield/no-git reviews, scope `artifacts:` to core logic, schemas, UI components, and tests; exclude static docs and generated output.

## Subagent fallback (`define_subagent` + `invoke_subagent`)

If `swarm` is unavailable or fails/stalls, define a read-only reviewer subagent once per conversation via `define_subagent`:
- `Name`: `"adversarial-reviewer"`
- `EnableWriteTools`: `false`
- `SystemPrompt`: instruct the reviewer to read `./reviewer.md` (using its absolute path) first and follow it strictly (treating `ask` as `ask_question` and checking `AGENTS.md`/`GEMINI.md` if present), or embed `reviewer.md` directly.

Pass the shared fields in `Prompt` to `invoke_subagent` (`TypeName: "adversarial-reviewer"`). This fallback separates tiers only, not model families:
- If implementation slices ran on `"flash"`, run the reviewer on `Model: "pro"` (or `"inherit"` if the coordinator is on a larger tier).
- If the coordinator/author ran on `"pro"` (or `"inherit"`), run the reviewer on `Model: "flash"` (or `"pro"` for critical security/architecture reviews where depth matters more than tier separation).
- When both coordinator-written files (wave-0 spec tests, inline edits, `sonic` text) and `synth`-written files exist, run one reviewer covering the combined scope.

## Quota / 429 fallback

When the reviewer hits `RESOURCE_EXHAUSTED` (429):
1. Call `swarm{action: "models", all: true}` to inspect per-model `quotas` (`quota_remaining`, `quota_resets`).
2. If every model reports `0%` `quota_remaining`, stop and call `ask_question` with the earliest `quota_resets` timestamp.
3. Otherwise, switch or spawn a replacement `reviewer` on a healthy non-zero-quota model from a different family/line.
