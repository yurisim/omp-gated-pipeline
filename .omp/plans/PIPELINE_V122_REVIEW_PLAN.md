# omp-gated-pipeline: post-1.2.2 effectiveness review and fixes

## Context

The user asked how well the 1.2.2 updates (commit `b68efb3`, 2026-11-01 18:35 -0500) work: what worked, what didn't, what to add, what to remove; whether fan-out actually parallelized; whether Opus reviewed Sol-written work and Sol reviewed Opus-written work. Evidence is every session after the commit, read from `~/.omp/agent/sessions/` via `archive` plus transcript parsing (main JSONL + subagent JSONL + `__advisor.jsonl` files):

- Execution: desktop-agent `01a19994` (page digest), `01a199e0` (headless/teach/sitemaps), `01a19a1d` (Playwright recording), `01a19a42` (test trim), `01a19a68` (Gemini malformed call), `01a19a8b` (bundled Chromium), `01a19ab2` (single-file prompt fix).
- Planning only: desktop-agent `01a19981`, `01a199f9`, `01a19a37`, `01a19a64`; som `01a19a23`.
- Exempt single-file content edit: som `01a19a25` (no pipeline, correctly).

End state: the package keeps what worked, closes the routing and reviewer-coverage gaps the transcripts show, and ships as 1.2.3.

## Findings

### Parallelization: yes, real but bounded

| Session | Slice batches (slices) | Slice sum / wall (min) | Speedup | Review pair in parallel |
|---|---|---|---|---|
| 01a19994 | 1 (2) | 2.9 / 1.6 | 1.7x | yes |
| 01a199e0 | 2 (3 + 1) | 8.0 / 4.7 | 1.7x | yes |
| 01a19a1d | 2 (2 + 1) | 9.8 / 8.0 | 1.2x | yes |
| 01a19a42 | 1 (6) | 15.1 / 3.9 | 3.9x | yes |
| 01a19a68 | 1 (1) | 1.6 / 1.6 | 1.0x | yes |
| 01a19a8b | 1 (synth + sonic) | 2.5 / 2.2 | 1.1x | yes |

- 16 implementation slices, all on Sol (`gpt-6.1-sol`); every second wave was a true dependency (S4 consumed S1–S3; S3 consumed S1/S2). Planning sessions ran scouts as parallel batches of 2 and 3.
- Slices are not the bottleneck: they took 1.6–8 min of 7–31 min executions. The long poles are the Opus coordinator's integration/live verification (1.2–15.8 min) and the Opus reviewer (7.0–10.2 min to first yield vs 1.2–3.6 min for the Sol reviewer).

### Cross-family review: routing was followed, with one structural gap

- Every code execution (6/6) spawned `adversarial-reviewer` (Opus, Sol advisor) on synth-written files and `adversarial-reviewer-sol` (Sol, Opus advisor) on coordinator-written files (wave-0 spec tests, docs, inline fixes) in one batch. `01a19ab2` (coordinator-only edit) correctly used only `adversarial-reviewer-sol`. Transcript models confirm: Opus reviewers ran `claude-opus-5-5` with `gpt-6.x-sol` advisors; Sol reviewers ran `gpt-6.1-sol` with `claude-opus-5-5` advisors.
- Gap: `skills/adversarial-review/SKILL.md:9-10` sends any file the coordinator touched to the Sol reviewer only. In 4/6 sessions the coordinator added 2–7 lines to a synth-written file before review, so the synth's code in that file was reviewed by Sol only: `executor.py`/`agent.py` (S1, ~148 added lines, coordinator +9) in 01a19994; `panel.py` (S2, 64) and `sitemaps.py` (S3, 231; coordinator +4/+6) in 01a199e0; `pw.py` (S1, 198; coordinator +5) in 01a19a1d; `agent.py` (S1, 17; coordinator +3) in 01a19a8b. The Opus advisor of the Sol reviewer is the only Opus look at that code.

### What worked

- **Reviews keep finding real defects no gate caught**, then fixed through the owning synth via `write agent://` (audit fixes went to Sol owners in 01a19994, 01a19a1d, 01a19a42, 01a19a8b): token forwarded on HTTP redirect, email addresses kept in site-map paths, `import` deleting shared maps, picked model suggestions counting as user-named sites, initial-page Open missing from web recordings, bundled-Chromium error caching and wrong error line, two wrongly deleted tests.
- **Advisors earn their cost.** 12 of 13 reviewer runs got an advisor note; 11 of those (every `concern`/`blocker`) triggered one revision, the one `nit` did not. Opus advisors on Sol reviewers caught coverage misses (unread plan, elided hunks, an untested focus lock, a prompt contradiction that was then fixed in `prompt.py:55`). Sol advisors on Opus reviewers added the site-map query/foreign-link trust-boundary finding (fixed) and talked an unsupported migration CRIT down. One Sol advisor claim was refuted with cited lines (01a19a68 ReviewSrc), as `reviewer.md:103` intends.
- **1.2.2 fixes held:**
  - Revised reviewer reports are complete (revised yields are 0.8–1.3x the original length, every one carries verdict, findings, Summary, Handoff); no delta reports.
  - Subagent skill loading: 0/18 synth/sonic and 0/13 reviewers read a coordinator skill or graphify. The only synth skill reads were `skill://ui-check` (2), which desktop-agent `AGENTS.md:18` mandates for `src/lomanoha/ui/`. Residual: 7/7 built-in scouts and the one generic `task` read graphify; 1 scout read plan-preflight (expected; not package-owned).
  - Preflight ran on `.omp/plans/*` autosave copies three times with no `UNLISTED_CALLER` false positive.
  - Todo progress: 5/6 executions closed slice items as each slice returned, before the next wave. 3/6 used the prescribed `Wave N` phases with outcome-named items; the others used action names (`Spawn S1-S6 synth slices`) or one `Execute` phase.
- **Deterministic gates paid off:** preflight caught untagged `[NEW]` paths twice at plan time (01a19981, 01a199f9); a synth's Turn 1 gate raised a real SPEC_CONFLICT against the coordinator's wave-0 tool `covdiff.py` (01a19a42 S4), stopping a bad slice before edits.
- **Main-session advisor (agent-end)** cost $0.07–0.30 per session and raised a useful note in 5 sessions (e.g. a 40x40 icon-button rule violation, stale CHECKS file).

### What didn't work

- The mixed-authorship routing gap above.
- Sol reviewers concluded on unread material: 3 of the 6 Opus-advisor notes to Sol reviewers say the reviewer never read the plan or saw elided hunks (`[…Nln elided; re-read needed ranges…]`) yet relied on them (01a19a42 ReviewCoordTrim gave CLEAN on elided `integrate.patch` lines; 01a199e0 and 01a19a8b ReviewOpusFiles claimed plan-drift checks without opening the plan). `reviewer.md:43` says "Read the FULL in-scope file(s)" but says nothing about elision markers or the plan.
- SPEC_CONFLICT handling contradicts practice: `skills/parallel-fanout/SKILL.md:62` says always `ask` the user; in 01a19a42 the conflict was in the coordinator's own wave-0 tool, the coordinator fixed it and broadcast in 15 s without asking, which was the right call.
- Preflight invocation: 2/15 runs failed with exit 2 because the coordinator wrote `%USERPROFILE%` in bash instead of the command in `skills/plan-preflight/SKILL.md:10` (recovered immediately both times).
- Plans still get no LLM review (plan-mode proposes end `aborted`, no advisor). Unchanged by user decision in the 1.2.1 review; not reopened here.

### Spend (USD, transcript usage, all 13 post-commit sessions)

| Component | USD | Share |
|---|---|---|
| Opus coordinator (planning + execution) | 58.73 | 68% |
| Reviewers | 14.25 | 16% |
| Sol workers (synth, sonic, scouts) | 8.17 | 9% |
| Reviewer advisors | 4.16 | 5% |
| Main-session advisors | 1.24 | 1% |

Opus reviewers cost 2–5x their Sol counterparts per run ($0.58–3.88 vs $0.10–0.78). The Opus advisor of a Sol reviewer costs about as much as the reviewer itself ($0.25–0.86), and gave a substantive note in 6 of 7 runs.

### What to remove

Nothing with evidence of zero value. Candidates checked and kept: the pre-wave-1 preflight rerun (always `pass`, but ~50 ms and one tool call, and it guards post-approval edits); the Opus advisor on Sol reviewers (expensive but caught misses in 6/7 runs); the todo progress paragraph (it changed behavior in 5/6 runs).

## Approach

The user chose: (1) **owner edits only**: before the review, the coordinator never edits a file a `synth` owns in the current run, and sends the change to that synth instead; (2) **keep the one-review-pass cooldown** (post-review fixes get no second review). The steps are independent instruction edits; do them in order. Run everything from `C:/Users/yuras/projects/omp-gated-pipeline`. Line numbers are from HEAD `b68efb3`; reread each file before editing.

### 1. Owner edits only

- `rules/gated-pipeline.md` line 10: append this sentence to the end of the bullet (same line, after `… 30 changed lines or fewer.`):
  ` During a pipeline run, a change to a file a \`synth\` slice owns goes to that synth (skill://parallel-fanout section 3, "Owner edits"), never an inline coordinator edit, even when an exemption below applies.`
- `skills/parallel-fanout/SKILL.md`: insert this paragraph after line 58 (`Keep working while siblings run. …`), with one blank line before and after it:

  ```markdown
  Owner edits: from the wave 1 spawn until the review is spawned, every change to a file in a `synth` slice's `owns` (integration fixes, live-run fixes, user-requested tweaks) goes to that synth with `write agent://<id>`: what to change and why (the observed failure or the user's request), plus `No new tests; do not edit tests.` Wait for it to return; synth rule 7 reruns its slice gate. Never edit those files inline, even for a one-line fix, so every file has one author family for review routing. If `write agent://<id>` fails because the agent no longer exists, spawn one `synth` whose `task` is the original slice JSON and whose `context` starts with `Slice already implemented in the tree; apply only this fix:` followed by the change. Files the coordinator owns (wave-0 contracts and spec tests, docs the plan leaves to the coordinator, `sonic` text) stay coordinator-edited.
  ```

- `skills/adversarial-review/SKILL.md`:
  - Line 9 becomes: `- \`adversarial-reviewer\` (Opus, Sol advisor) takes the files that only Sol agents wrote (\`synth\`, including fixes it applied on coordinator request, or a \`task\` agent that ran on Sol).`
  - Insert after line 11 (before the blank line 12) a new bullet: `- A file both families edited before the review means the "Owner edits" rule in skill://parallel-fanout section 3 was skipped: put it in both reviewers' \`artifacts:\`, each annotated with the hunks its author family did not write (for example \`src/x.py (Sol hunks: lines 40-180)\`).`
  - Leave line 10 unchanged: its "inline edits (exempt single-file fixes, …)" still describe coordinator-owned files.

### 2. Reviewers must not judge unread lines (`skills/adversarial-review/reviewer.md`)

Replace line 43 (`1. Read the FULL in-scope file(s), …`) with:

```markdown
1. Read the FULL in-scope file(s), not just the changed lines. Bugs live in the interaction between new and existing code. A read result containing `…Nln elided` has not shown you those lines: re-read the elided ranges by line range before relying on them. When SCOPE asks for drift against a plan, or KNOWN or PLAN_DEVIATIONS cite one, read the cited plan sections first. Never base a verdict or a `checked:` entry on lines you have not seen.
```

### 3. SPEC_CONFLICT in a coordinator-owned wave-0 artifact

- `skills/parallel-fanout/SKILL.md` line 62 (`Spec conflicts: …`) becomes:

  ```markdown
  Spec conflicts: a `synth` that returns a non-empty `specConflict` made no edits. Read each cited `file:line`. When every cited line is in a wave-0 artifact the coordinator wrote (contract, spec test, helper script) and the plan's intent is unambiguous, fix that artifact, rerun the check that covers it (`wave0-red` for a spec test), record the change in `planDeviations`, and send `Wave-0 fix: <what changed>. Rerun Turn 1.` to the synth with `write agent://<id>`. Otherwise `ask` the user with the `SPEC_CONFLICT` lines and what you found; after the user decides, patch the plan, rerun skill://plan-preflight, and send the corrected slice JSON to the same synth with `write agent://<id>`.
  ```

- `agents/synth.md` line 40, rule 7: replace its last sentence `When it messages a corrected slice spec after a SPEC_CONFLICT, rerun the Turn 1 Protocol on that spec first.` with `When it messages a corrected slice spec or a wave-0 fix after a SPEC_CONFLICT, rerun the Turn 1 Protocol first.`

### 4. Preflight invocation (`skills/plan-preflight/SKILL.md`)

Insert after line 12 (`` `-` reads the plan from stdin; … ``), with a blank line before it:
`Copy the command as written: bash expands \`~\`, but \`%USERPROFILE%\` is passed through literally and fails with exit 2.`

### 5. Version

`package.json` line 3: `"version": "1.2.2"` → `"version": "1.2.3"`.

## Critical files & anchors

- `skills/parallel-fanout/SKILL.md:58,62`: "Collect and gate" opening paragraph and the Spec conflicts paragraph.
- `skills/adversarial-review/SKILL.md:9-11`: reviewer routing bullets.
- `skills/adversarial-review/reviewer.md:43`: Method step 1.
- `rules/gated-pipeline.md:10`: Execution bullet (always-apply rule, `agents: main`).
- `agents/synth.md:40`: rule 7.

## Parallel waves

Serial: one inline slice of instruction-markdown and version edits; no code, scripts, tests, or build config.
Acceptance: grep -q "^Owner edits: from the wave 1 spawn" skills/parallel-fanout/SKILL.md && grep -q "Wave-0 fix: <what changed>" skills/parallel-fanout/SKILL.md && grep -q "Owner edits\"), never an inline coordinator edit" rules/gated-pipeline.md && grep -q "was skipped: put it in both reviewers" skills/adversarial-review/SKILL.md && grep -q "re-read the elided ranges by line range" skills/adversarial-review/reviewer.md && grep -q "or a wave-0 fix after a SPEC_CONFLICT" agents/synth.md && grep -q "%USERPROFILE%" skills/plan-preflight/SKILL.md && grep -q "\"version\": \"1.2.3\"" package.json && python -m unittest discover -s tests

No AGENTS.md in this repo (no-barrier path). The package is symlinked into `~/.omp/plugins/node_modules/omp-gated-pipeline`, so edits are live without relinking. Every changed file is instruction markdown or `package.json` metadata that no code or test reads: record `docs-only; no integration gate` in CHECKS; the change is exempt from the adversarial review pass (docs-only).

## Verification

Run from `C:/Users/yuras/projects/omp-gated-pipeline`.

1. The Acceptance command above exits 0 (unittest reports the existing 16 tests OK).
2. `python skills/plan-preflight/preflight.py - < local://pipeline-v122-review-plan.md` returns `"verdict": "pass"` with `slices: 0`.
3. **Reviewer re-reads elided ranges (new behavior, step 2):**
   - In Python eval, write `local://smoke-long.py` with 400 functions `def f_<i>(x):\n    return x + <i>\n\n` for `i` in 0..399, except `f_217`, which returns `x - 217`.
   - Spawn one `task` item, `agent: "adversarial-reviewer-sol"`, `name: "SmokeElide"`, context `Adversarial second-opinion review. OUTPUT is a file; INTENT states what it was for.`, task:
     ```
     Review OUTPUT against INTENT. SCOPE: artifacts: local://smoke-long.py (read whole); concerns: correctness; exclusions: everything else.
     BASE: none (no commits)
     OUTPUT: local://smoke-long.py
     CHECKS: none
     KNOWN: none
     INTENT: "every f_i(x) returns x + i" — each function adds its own index.
     ```
     `solutionSpace`: `Defect cause open within SCOPE.` Then `wait`.
   - Pass: the returned report flags `f_217` (CRIT or WARN citing its line). In `<session dir>/SmokeElide.jsonl` (session dir from `archive.sessions(project="~/projects/omp-gated-pipeline", limit=1, silent=True)`, `rows[0]["file"][:-6]`), every `read` result containing `ln elided` is followed by a ranged `read` (path with `:`) of the same file.
   - If no read result contains `ln elided`, the elision rule was not exercised: report "inconclusive: file was not elided" and do not enlarge the file further.
4. Steps 1, 3 and 4 change coordinator behavior that only a live multi-wave run exercises; the grep checks in Acceptance are their proof here. State that in the final report.
5. `git status --short` lists only `rules/gated-pipeline.md`, `skills/parallel-fanout/SKILL.md`, `skills/adversarial-review/SKILL.md`, `skills/adversarial-review/reviewer.md`, `agents/synth.md`, `skills/plan-preflight/SKILL.md`, `package.json`.

## Assumptions & contingencies

- Nothing is committed or pushed; the user reviews the diff first.
- If Verification 3 fails (the reviewer misses `f_217` after an elided read), keep the step 2 text and report the failure with the transcript lines. Do not add more instruction text in this run.
- Not changed by user decision: no LLM plan review (`rules/gated-pipeline.md:9`), and the one-review-pass cooldown (`skills/adversarial-review/SKILL.md:60`).
