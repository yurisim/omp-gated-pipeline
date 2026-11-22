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

## Cross-family review via `swarm` (preferred)

Because `invoke_subagent` only exposes same-family tiers (`"flash"`, `"pro"`, `"inherit"`), prefer `swarm` for the adversarial review pass so the reviewer runs on a different model family/line than the author:
1. Call `swarm{action: "models", all: true}` and choose a healthy non-zero-quota model from a different family/line than the implementation author.
2. Spawn a read-only `reviewer` worker via `swarm{action: "add", name: "reviewer", model: <chosen>, workspace: "inherit"}`. Pass [reviewer.md](./reviewer.md)'s absolute path plus the `SCOPE`, `BASE`, `OUTPUT`, `CHECKS`, `BASELINE_CHECKS`, `PLAN`, `PLAN_DEVIATIONS`, `KNOWN`, and `INTENT` fields in the brief, and instruct the worker to read `reviewer.md` strictly with no edits, shell commands, or subagents, and to call `post_message` mentioning `@coordinator` with its report before ending its turn.
3. Apply three safeguards:
   - **Unmapped catalog keys**: `swarm{action: "models", all: true}` can list models whose backend key is unavailable (`unknown model key ...: model not found`). If a reviewer fails on startup, kill it immediately and fall back to another verified model line (using a fresh name like `reviewer-2`) or to `define_subagent` + `invoke_subagent` below.
   - **Stall fallback**: If a swarm reviewer stays `working` for >3 minutes with no board post (common on large untracked greenfield file sets), kill it and run the read-only `adversarial-reviewer` subagent via `invoke_subagent`.
   - **Focused untracked scope**: For greenfield/no-git reviews, scope `artifacts:` to core logic, schemas, UI components, and tests (excluding static docs and generated output) so the reviewer finishes cleanly.
4. Kill the reviewer worker via `swarm{action: "kill"}` once the verdict has been handled.

## Subagent fallback (`define_subagent` + `invoke_subagent`)

If `swarm` is unavailable or fails/stalls, define a read-only reviewer subagent once per conversation via `define_subagent`:
- `Name`: `"adversarial-reviewer"`
- `EnableWriteTools`: `false`
- `SystemPrompt`: instruct the reviewer to read `./reviewer.md` (using its absolute path) first and follow it strictly (treating `ask` as `ask_question` and checking `AGENTS.md`/`GEMINI.md` if present), or embed `reviewer.md` directly.

Invoke it with `invoke_subagent` (`TypeName: "adversarial-reviewer"`), passing `SCOPE`, `BASE`, `OUTPUT`, `CHECKS`, `BASELINE_CHECKS`, `PLAN`, `PLAN_DEVIATIONS`, `KNOWN`, and `INTENT` in `Prompt`:
- If implementation slices ran on `"flash"`, run the reviewer on `Model: "pro"` (or `"inherit"` if the coordinator is on a larger tier).
- If the coordinator/author ran on `"pro"` (or `"inherit"`), run the reviewer on `Model: "flash"` (or `"pro"` for critical security/architecture reviews where depth matters more than tier separation).
- When both coordinator-written files (wave-0 spec tests, inline edits, `sonic` text) and `synth`-written files exist, run one reviewer covering the combined scope.

## Quota / 429 fallback

When the reviewer hits `RESOURCE_EXHAUSTED` (429):
1. Call `swarm{action: "models", all: true}` to inspect per-model `quotas` (`quota_remaining`, `quota_resets`).
2. If every model reports `0%` `quota_remaining`, stop and call `ask_question` with the earliest `quota_resets` timestamp.
3. Otherwise, switch or spawn a replacement `reviewer` worker on a healthy non-zero-quota model from a different family/line, and kill it via `swarm{action: "kill"}` after handling the verdict.
