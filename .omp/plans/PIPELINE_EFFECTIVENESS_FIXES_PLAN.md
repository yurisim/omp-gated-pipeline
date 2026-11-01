# omp-gated-pipeline: synchronous advisor review + coordinator-only review skill

## Context

The user asked whether, in the som AI570 run, the main agent fanned work out to the `task`/`smol` (Sol) subagents, whether the adversarial gates worked, and whether the architect → Sol → barrier → audit design holds up. Evidence comes from som sessions `01a198ba` (planning) and `01a198cc` (execution) on 2026-11-01, under `~/.omp/agent/sessions/-projects-som/`. From the fixes offered, the user chose: (1) make advisor reviews synchronous and final-only, for the main session and for reviewer subagents, so a reviewer cannot return before its advisor's verdict arrives; (2) limit `skill://adversarial-review` to the main-session coordinator so worker subagents stop loading it.

## Findings

- **Fan-out happened.** Planning ran 7 `scout` auditors on Sol 6.1. Execution ran 6 `synth` deck slices and 1 `synth` merge on Sol 6.1, 2 generic `task` glossary drafters (on Sol through `modelRoles.task`), and 1 `adversarial-reviewer` (Opus with a Sol advisor). No slice raised a SPEC_CONFLICT, every slice's acceptance check passed, and the integration barrier returned `pass 171`.
- **Skills reached the subagents.** The synths read `skill://ai570-lecture-batch` and `skill://svg-landmark-verify`, and the glossary drafters read `skill://som-glossary-add`.
  - Over-trigger: all 16 subagents also read `skill://adversarial-review` (10.4 KB), because its description ("use after drafting code, content, or answers") matches every worker. 3 scouts also read `skill://graphify`.
- **Spend** (USD, from transcript usage), ≈ 36.25 in total:

  | Component | USD |
  |---|---|
  | Main-session advisor (gpt-6-sol, reviews every turn) | 15.28 |
  | Opus coordinator | 9.56 |
  | Review (Opus 4.42 + its Sol advisor 2.07) | 6.49 |
  | Sol workers | 4.92 |

  The execution-session advisor alone ran 536 turns and gave 3 notes.
- **Review caught real defects.**
  - The reviewer found 3 real defects that every deterministic gate missed: Q61 literal backticks, Q191 contradicting slide 8, and Q198's figure lining up with a distractor.
  - The coordinator's own visual check of the figures caught 3 more.
- **A finding was lost to timing.**
  - The reviewer returned CONCERNS at 20:44:39.
  - Its Sol advisor sent a blocker on Q55 at 20:45:42.
  - The reviewer revised to BLOCK at 20:46:29, but the coordinator never received that version. Q55 shipped in som commit `fed8058`.
  - The planning-session advisor flagged the same Q55 problem 1 s after `xd://propose`.
  - Root cause: the advisor reviews every turn asynchronously (`advisor.reviewMode: turn`, `advisor.syncBacklog: off`), so nothing makes the reviewer wait for it.
- **The plan was a source of defects.** Q55 and Q191 were copied word for word from the Opus plan (`ai570-cnn-audit-plan.md` lines 106 and 163), so architect errors pass unchanged through Sol and the barrier.

## Approach

The steps are independent. Do them in the order below so the smoke tests in Verification run against the final state.

1. **Synchronous, final-only advisor (user config).** In `C:/Users/yuras/.omp/agent/config.yml`, replace the `advisor:` block (currently lines 26–27: `advisor:` / `  enabled: true`) with:

   ```yaml
   advisor:
     enabled: true
     reviewMode: agent-end
     syncBacklog: strict
   ```

   Edit only those lines.
   - What this does, from `omp://advisor-watchdog.md` (sections "Catch-up with `advisor.syncBacklog`" and "Subagents"):
     - `agent-end` reviews only final yields.
     - With `strict`, the primary waits at its final boundary until that review finishes.
     - A note at `concern` or above (default `advisor.continueSeverity`) triggers one continuation, and that continuation is not re-reviewed, so it cannot loop.
     - Subagents read the parent's settings through `parent.overlay`, and settings reload before every spawn. Advised reviewer subagents therefore get the same behavior without a `WATCHDOG.yml`.
     - Do NOT create a `WATCHDOG.yml`: any roster entry replaces the built-in default advisor.
   - Keep `modelRoles.advisor` (`openai-codex/gpt-6-sol:high`) unchanged. It is the Sol advisor for `adversarial-reviewer` (`advisor: true`). `adversarial-reviewer-sol` keeps `advisor: "@slow"` (Opus).
2. **Document the required settings (package).** In `README.md`, insert this section after the Install section (after line 15, before `## Project contract`), with a blank line before and after it:

   ```markdown
   ## Required omp settings

   The reviewer agents' advisor must finish its review before the reviewer returns. Set in `~/.omp/agent/config.yml`:

       advisor:
         enabled: true
         reviewMode: agent-end
         syncBacklog: strict

   These also apply to the main session's advisor: one synchronous review per run instead of one per turn. Do not add a `WATCHDOG.yml` advisor roster; any entry replaces the default advisor these settings configure.
   ```

3. **Correct the advisor note in the review skill.** In `skills/adversarial-review/SKILL.md`, replace line 54 (the line starting `Notes: both agents load their instructions`) with:

   `Notes: both agents load their instructions from skill://adversarial-review/reviewer.md and are read-only (\`read\`, \`grep\`, \`glob\`). Each pairs with an advisor from the other family: \`adversarial-reviewer\` runs on \`@slow\` with \`advisor: true\` (the \`advisor\` model role); \`adversarial-reviewer-sol\` runs on \`openai-codex/gpt-6.1-sol:high\` with \`advisor: "@slow"\`. Override either advisor via \`task.agentAdvisor\`. With the omp settings in the package README ("Required omp settings"), the advisor reviews the reviewer's finished run before the reviewer returns, and a \`concern\` or \`blocker\` gets one revision pass, so the returned report already includes the advisor's review.`

   (`:max` → `:high` makes the line match `agents/adversarial-reviewer-sol.md` line 4.)
4. **Limit the skill to the coordinator.** In `skills/adversarial-review/SKILL.md`, replace line 3 with:

   `description: Main-session coordinator only; subagents never load this skill (reviewer agents read only skill://adversarial-review/reviewer.md). Hostile second-opinion review, scoped to the requested change, by a reviewer from the model family that did not write the work. Use after drafting code, content, or answers (plans only on explicit user request), before merging, or when a review felt too agreeable.`

   - Leave the `name:` line and the body unchanged. `rules/gated-pipeline.md` (`agents: main`) already sends the coordinator here, so the coordinator still triggers it.

## Critical files & anchors

- `C:/Users/yuras/.omp/agent/config.yml:26-27`: the `advisor:` block (user-level config, outside the repo).
- `skills/adversarial-review/SKILL.md:3` (description) and `:54` (Notes line).
- `README.md:10-15`: the Install section; the new section goes after it.

## Parallel waves

Serial: one inline slice of docs and user-config edits; no code, scripts, tests, or build config.
Acceptance: grep -q "^description: Main-session coordinator only" skills/adversarial-review/SKILL.md && grep -q "^## Required omp settings" README.md && grep -q "reviewMode: agent-end" ~/.omp/agent/config.yml && grep -q "syncBacklog: strict" ~/.omp/agent/config.yml && python -m unittest discover -s tests

Run it from `C:/Users/yuras/projects/omp-gated-pipeline`. The repo has no AGENTS.md (no-barrier path).
- Repo changes are `README.md` and `skills/adversarial-review/SKILL.md`, which no code, test, or build reads, so record `docs-only; no integration gate` in CHECKS.
- Docs-only edits are exempt from the adversarial review pass.
- The package is symlinked (`~/.omp/plugins/node_modules/omp-gated-pipeline -> C:\Users\yuras\projects\omp-gated-pipeline`), so edits are live and no relink is needed.

## Verification

Run everything from `C:/Users/yuras/projects/omp-gated-pipeline` in the executing session, after Approach steps 1–4.

1. **Settings resolved:** `read cfg://advisor/reviewMode` reports `agent-end`, and `read cfg://advisor/syncBacklog` reports `strict`, both from the global layer.
2. **The race is gone (new behavior).**
   - Write `local://smoke-mean.py` containing:
     ```python
     def mean(xs):
         return sum(xs) / (len(xs) + 1)
     ```
   - Spawn one `task` item with `agent: "adversarial-reviewer"` and `name: "SmokeReview"`. The context is `Adversarial second-opinion review. OUTPUT is a file; INTENT states what it was for.` The task is:
     ```
     Review OUTPUT against INTENT. SCOPE: artifacts: local://smoke-mean.py (read whole); concerns: correctness; exclusions: everything else.
     BASE: none (no commits)
     OUTPUT: local://smoke-mean.py
     CHECKS: none
     KNOWN: none
     INTENT: "write mean(xs) returning the arithmetic mean of a non-empty list" — return the correct average.
     ```
     `solutionSpace` is `Defect cause open within SCOPE.` Then call `wait`.
   - In Python eval:
     - Find the current session with `rows = await archive.sessions(project="~/projects/omp-gated-pipeline", limit=1, silent=True)`. The session dir is `rows[0]["file"][:-6]`.
     - Load `<dir>/SmokeReview/__advisor.jsonl` and `<dir>/SmokeReview.jsonl`.
   - Pass when all of these hold:
     - (a) The advisor transcript exists and holds exactly one review prompt: one synthetic user/update message. An `agent-end` cadence means one review per run.
     - (b) The `timestamp` of the advisor's last assistant entry is earlier than the parent session's `toolResult` entry for the `wait` that returned SmokeReview (same session file, `rows[0]["file"]`).
     - (c) If `SmokeReview.jsonl` contains a `custom_message` with `customType: "advisor"`, it contains an assistant text after it, and the result `wait` returned matches that later text (its first 200 characters).
   - Fail case: reproduce the 2026-11-01 pattern, where the advisor finished after the result was delivered.
3. **Workers no longer load the review skill.**
   - Spawn one generic `task` (no `agent` field), `name: "SmokeDraft"`, with the task: `In C:/Users/yuras/projects/som, draft one glossary definition (≤420 characters) for the term "learning rate" in the style of src/app/glossary/glossary.json. Edit no files; return only the definition.`
   - After `wait`, scan `<dir>/SmokeDraft.jsonl` for any tool call whose `path` contains `skill://adversarial-review`.
   - Expect none. Baseline: the same kind of task (`GlossMisc`, `Gloss1005` in session `01a198cc`) read it.
4. **Regression:** `python -m unittest discover -s tests -v` exits 0.
5. **Cleanup:** smoke artifacts live only in `local://`, so there is nothing to delete in the tree. Confirm `git status --short` lists only `README.md` and `skills/adversarial-review/SKILL.md`.

## Assumptions & contingencies

- **Nothing is committed or pushed.** The changes stay uncommitted for the user to review.
- **If Verification 2 fails on (b) or (c)** (the advisor still lands after the result), switch the reviewers to advisor-free, dual-family review:
  - Set `advisor: false` in `agents/adversarial-reviewer.md` line 5.
  - Delete the `advisor: "@slow"` line (line 5) in `agents/adversarial-reviewer-sol.md`.
  - Remove the clauses "with a Sol advisor" / "with an Opus advisor" from both agents' `description` lines, and "your advisor runs on …" from their body line 9.
  - Replace `skills/adversarial-review/SKILL.md` lines 8–11 with: `A reviewer with different weights breaks self-review blindness. Run one review pass, scoped to what the user asked for: spawn \`adversarial-reviewer\` (Opus) and \`adversarial-reviewer-sol\` (Sol) in one \`task\` batch, both on the full OUTPUT with identical SCOPE; that batch is the one review pass. Handle their findings together; a finding from either reviewer counts.`
  - Rewrite the new Notes line (step 3) to say the agents run without advisors, and README line 8 to drop the advisor wording.
  - Keep the step 1 config change: the main-session advisor still benefits.
  - Rerun Verification 4.
- **If Verification 3 still shows a read**, append to `agents/synth.md` Rules, as rule 8: `8. Never read skill://adversarial-review or skill://parallel-fanout; the coordinator runs review and fan-out.` Accept generic `task`/`scout` reads as residual: those agent definitions are built into omp, not this package.
- **In plan mode,** a final-boundary advisor note may show up as a visible card instead of a continuation (plan-mode delivery policy in `omp://advisor-watchdog.md`). The user then sees it before approving. No action needed.
