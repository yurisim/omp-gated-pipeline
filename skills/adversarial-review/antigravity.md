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
- When both coordinator-written files (wave-0 spec tests, inline edits, `sonic` text) and `synth`-written files exist, run one reviewer covering the combined scope (tiers stay in one model family, so two reviewers add cost without cross-family separation).
- When the user is already running `/swarm`, you may pin the reviewer worker to a different model family/line than the author with `swarm{action: "add", model: ...}` for cross-family review, with three safeguards:
  1. **Unmapped catalog keys**: `swarm{action: "models", all: true}` can list models whose backend key is unavailable (`unknown model key ...: model not found`). If a reviewer fails on startup, kill it immediately and fall back to another verified model line or to `define_subagent` + `invoke_subagent` (`Model: "flash"`).
  2. **Stall fallback**: If a swarm reviewer stays `working` for >3 minutes with no board post (common on large untracked greenfield file sets), kill it and run the read-only `adversarial-reviewer` subagent via `invoke_subagent` (`Model: "flash"`).
  3. **Focused untracked scope**: For greenfield/no-git reviews, scope `artifacts:` to core logic, schemas, UI components, and tests (excluding static docs and generated output) so the reviewer finishes cleanly.

## Quota / 429 fallback

Outside an explicit `/swarm` invocation or the 429 fallback below, never invoke `swarm`.

When `invoke_subagent` hits `RESOURCE_EXHAUSTED` (429), or when the pipeline already fell back to `swarm` workers on 429:
1. Call `swarm{action: "models", all: true}` to inspect `quotas` (`quota_remaining`, `quota_resets`).
2. If every model reports `0%` `quota_remaining`, stop and call `ask_question` with the earliest `quota_resets` timestamp.
3. Otherwise, spawn a read-only `reviewer` worker via `swarm{action: "add", name: "reviewer", model: <chosen>, workspace: "inherit"}` on a healthy non-zero-quota model from a different family/line than the implementation workers (verify startup succeeds; if a catalog model returns `model not found`, kill it and use a suffixed name like `reviewer-2` on the next healthy model line). Pass [reviewer.md](./reviewer.md)'s absolute path in the brief and instruct the worker to read it strictly with no edits, shell commands, or subagents, post the verdict to `@coordinator`, and kill it via `swarm{action: "kill"}` after handling the verdict.
