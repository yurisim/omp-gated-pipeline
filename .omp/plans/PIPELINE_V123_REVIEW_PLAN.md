# omp-gated-pipeline: post-1.2.3 effectiveness review and fixes

## Context

The user asked how well the agents have worked since the last update (1.2.3, commit `328d89c`, 2026-11-02 08:17 -0500) and for improvements, subtractive ones allowed. Evidence: every session created after the commit, read from `~/.omp/agent/sessions/` via `archive` plus transcript parsing (main JSONL, subagent JSONL, `__advisor.jsonl`): 48 sessions across desktop-agent, ai-101, som, DOD SAFE, avas; 24 executed an approved plan (18 with `synth` slices); 58 adversarial-review runs.

End state: the package keeps what worked, fixes one false instruction and the reviewer plan-reading gap, trims one unused format rule, and ships as 1.2.4. User decisions: fix plan reading with a mechanical `PLAN:` field; leave concurrent same-tree runs alone.

## Findings

### 1.2.3 changes

| Change | Result |
|---|---|
| Owner edits only | Held. 0 coordinator edits to `synth`-owned files between wave-1 spawn and review spawn in 18 runs (edit/write tools plus eval/bash writes checked). 68 `write agent://` fix messages, 68 delivered (30 revived parked agents). Wave-0 coordinator hunks in later synth-owned files were annotated per reviewer (01a1b08e, 01a1b389). |
| Reviewers re-read elided lines | Partly held. 28 elided reads in 58 runs; 21 re-read by range, 7 not (5 of them `integrate.json`). Advisors still flagged conclusions on unread material in 6 runs. |
| Reviewers read cited plan sections | Failed. 35 review tasks cited plan lines (`KNOWN: local://flamingo-loop-plan.md:548 …`); the reviewer opened the plan in 3. 4 advisor blockers were "you never opened the plan" (01a19d4a, 01a19eec, 01a1a92f, 01a1ae36). |
| Coordinator fixes wave-0 SPEC_CONFLICT | Not exercised: 0 non-empty `specConflict` in 126 synth yields. |
| Preflight invocation note | Held. 0 `%USERPROFILE%` failures in 62 runs (was 2/15). 8 non-JSON runs: 6 coordinator probes of `local://` redirection, 1 broken uv workspace, 1 source read. |

### Parallelization

Synth batches: slice-time sum / slowest slice = 1.0x to 4.5x, median about 1.4x (01a1a92f: 7 slices, 8.4/1.9 min). Slices take 0.5 to 12 min; reviews 1.1 to 8.4 min (Opus reviewer median 4.3, Sol 1.9). Slices are not the long pole.

### Cross-family review

58/58 review spawns routed correctly (11 heuristic flags checked by hand: eval-spawned synths, build outputs, post-review coordinator follow-up edits, annotated wave-0 hunks). Opus reviewers: 25 runs, 2 CRIT, 37 WARN. Sol reviewers: 33 runs, 8 CRIT, 39 WARN. Fixes went to the owning synths (45 of 126 synth yields carry review- or coordinator-requested `planDeviations`): `save_image` downloading from user-blocked sites with browser cookies, a replay risk-rewrite bypassing the approval gate, a stream handle leak on timeout, task text persisted in a risk cache.

### Advisors

- Reviewer advisors: a note in 42/58 runs (34 concern, 8 blocker, 1 nit). Opus advisors on Sol reviewers cost $16.39 (33 runs), more than the Sol reviewers ($9.20).
- Main-session advisor (Sol): $6.29 for 26 runs, 34 notes (11 blockers). It is the only second look at post-review audit fixes (the cooldown skips re-review) and caught bugs in 4 of them (UNC folder fix, shutdown-hang fix, SVG audit bypass, capture mask hashing), plus skipped UI/slide checks, a disputed CRIT being closed, and the false-`task`-model case below.

### False instruction: generic `task` agent model

`skills/parallel-fanout/SKILL.md:50` says the generic `task` agent "inherits the parent's model". It does not: `~/.omp/agent/config.yml` maps `task: openai-codex/gpt-6.1-sol:xhigh`, and every generic `task` spawn ran on `gpt-6.1-sol` (RosieOpus in 01a19eec, S2Slide12Icons in 01a1a946). Per-call `model` overrides are also unavailable: `task.perCallModel` defaults to `off` (omp `task-agent-discovery.md`, "Per-call `model`") and the config does not set it. In 01a19eec the user asked for "opus (the default agent)" to make an image; the coordinator spawned a generic `task` named `RosieOpus`, which ran on Sol.

### Unused rule text

Defender-step disposition lines (`skills/adversarial-review/SKILL.md:60`): 4 such lines in 24 executions. Coordinators account for findings in prose ("the two reviewers raised 12 items. I fixed 10, you chose Fix on … and Dismiss on …"); both final reports read (01a1a45f, 01a1b389) accounted for every finding.

### Spend (USD, all 48 sessions)

| Component | USD | Share |
|---|---|---|
| Opus coordinator | 224.24 | 64% |
| Opus reviewers | 41.87 | 12% |
| Sol synth/sonic/task | 21.51 | 6% |
| Project checkers (slide-/ui-checker, Opus, not package) | 19.03 | 5% |
| Reviewer advisors | 18.72 | 5% |
| Sol reviewers | 9.20 | 3% |
| Sol scouts | 8.24 | 2% |
| Main-session advisor (Sol) | 6.29 | 2% |

Coordinator cost in execution sessions by phase: follow-up user turns after the first report 57%, review handling and fixes 16%, while slices run 10%, integration and live verification 9%, wave 0 8%. Coordinator contexts reach 130K to 476K tokens; inlined plans are a median 8K tokens (up to 20K).

### Observed, not changed

- Concurrent pipeline runs in one working tree (2 of 18: 01a19fb8 with 01a19fbb, 01a19f76 with 01a19f7a) overwrote `.scratch/barrier/S2.json` and polluted `wave0-red`/`integrate`; coordinators recovered (unique labels, an `ask`). Left alone by user decision.
- Preflight `UNLISTED_CALLER` false positive on a generic method name (`Executor.wait`, 21 doc hits), cleared by writing the old signature into the symbol entry. 1 of 9 preflight failures; the other 8 were real (missing `[NEW]` tags on wave-0 test files in 3 plans, real unlisted callers in 5).
- `integrate-audit` failure in 01a1b389 (a test stub missing a new keyword) was fixed and rerun before the required `ask`; the main advisor flagged it; the user then accepted the fix.

## Approach

All steps are independent instruction edits plus a version bump; do them in order. Run from `C:/Users/yuras/projects/omp-gated-pipeline`. Line numbers are from HEAD `328d89c`; reread each file before editing.

### 1. Correct the generic `task` agent claim (`skills/parallel-fanout/SKILL.md`)

Replace line 50 (`   - Never use the generic \`task\` agent for an implementation slice: it inherits the parent's model.`) with:

```markdown
   - Never use the generic `task` agent for an implementation slice: it lacks `synth`'s output schema and Turn 1 gate. It runs on the `task` model role (the role `synth` uses), not the parent's model, and per-call `model` overrides are off by default; when the user explicitly asks for Opus-authored work, the coordinator writes it inline.
```

### 2. Mechanical `PLAN:` field for reviewers

`skills/adversarial-review/SKILL.md`:
- Insert after line 38 (Prepare step `5. KNOWN: …`), as a new list item:
  ```markdown
  6. PLAN: when the change executes an approved plan, list the plan line ranges the reviewer needs as one comma-joined selector, for example `local://<slug>-plan.md:117-167,480-482`: the `## Parallel waves` JSON of every slice whose files are under review, the Approach steps those slices implement, and every plan line KNOWN or PLAN_DEVIATIONS cites. Otherwise `none`.
  ```
- Line 47 (Invoke JSON `task` string): insert `\nPLAN: <local://<slug>-plan.md:<ranges> or none>` directly after `\nBASELINE_CHECKS: local://<topic>-baseline-checks.md (or none)`, before `\nPLAN_DEVIATIONS:`.
- Line 53: change `the patch does not apply, and CHECKS is \`none\` unless` to `the patch does not apply, PLAN is \`none\`, and CHECKS is \`none\` unless`.

`skills/adversarial-review/reviewer.md`:
- Insert after line 17 (`- **KNOWN** (optional): …`):
  ```markdown
  - **PLAN** (optional): one comma-joined line-range selector into the approved plan (`local://<slug>-plan.md:<ranges>`) covering the slice specs, plan steps, and plan lines that KNOWN and PLAN_DEVIATIONS cite.
  ```
- Line 43 (Method step 1): replace the sentence `When SCOPE asks for drift against a plan, or KNOWN or PLAN_DEVIATIONS cite one, read the cited plan sections first.` with `When PLAN is given, read it with one \`read\` of that exact selector before any other in-scope file; a KNOWN item, deviation, or drift check whose plan line you have not read is unverified.` Keep the rest of the line unchanged.

### 3. Trim the Defender-step format (`skills/adversarial-review/SKILL.md`)

Replace line 60 with:

```markdown
- **Defender step:** per finding Accept (fix it) or Refute (counter-evidence only). No silent drops, no self-granted "risk accepted". The report after handling the review accounts for every CRIT, WARN, and CHECK `caused by patch`: fixed (where), refuted (with the counter-evidence `path:line` or CHECKS quote), or decided by the user.
```

### 4. Version

`package.json` line 3: `"version": "1.2.3"` → `"version": "1.2.4"`.

## Critical files & anchors

- `skills/parallel-fanout/SKILL.md:50`: generic `task` bullet under "2. Fan out".
- `skills/adversarial-review/SKILL.md:38,47,53,60`: Prepare step 5, Invoke template, plans-and-answers paragraph, Defender step.
- `skills/adversarial-review/reviewer.md:17,43`: Input list, Method step 1.

## Parallel waves

Serial: one inline slice of instruction-markdown and version edits; no code, scripts, tests, or build config.
Acceptance: grep -qF 'the coordinator writes it inline' skills/parallel-fanout/SKILL.md && ! grep -qF "inherits the parent's model" skills/parallel-fanout/SKILL.md && grep -qF '6. PLAN: when the change executes an approved plan' skills/adversarial-review/SKILL.md && grep -qF 'PLAN: <local://<slug>-plan.md:<ranges> or none>' skills/adversarial-review/SKILL.md && grep -qF 'PLAN is `none`, and CHECKS' skills/adversarial-review/SKILL.md && grep -qF 'accounts for every CRIT, WARN, and CHECK' skills/adversarial-review/SKILL.md && ! grep -qF 'post one disposition line' skills/adversarial-review/SKILL.md && grep -qF '**PLAN** (optional)' skills/adversarial-review/reviewer.md && grep -qF 'When PLAN is given, read it with one' skills/adversarial-review/reviewer.md && grep -qF '"version": "1.2.4"' package.json && python -m unittest discover -s tests

No AGENTS.md in this repo (no-barrier path). The package is symlinked into `~/.omp/plugins/node_modules/omp-gated-pipeline`, so edits are live without relinking. Every changed file is instruction markdown or `package.json` metadata that no code or test reads: record `docs-only; no integration gate` in CHECKS; the change is exempt from the adversarial review pass (docs-only).

## Verification

Run from `C:/Users/yuras/projects/omp-gated-pipeline`.

1. The Acceptance command exits 0 (unittest reports the existing tests OK).
2. `python ~/.omp/plugins/node_modules/omp-gated-pipeline/skills/plan-preflight/preflight.py - < local://pipeline-v123-review-plan.md` returns `"verdict": "pass"` with `slices: 0`.
3. **Reviewer reads PLAN first (new behavior, step 2):**
   - Write `local://smoke-plan.md` with 40 lines: lines 1-19 and 21-40 are `filler line <n>`, line 20 is `` Contract: `scale(x)` returns `x * 3`; it never adds. ``
   - Write `local://smoke-out.py` containing exactly `def scale(x):\n    return x + 3\n`.
   - Spawn one `task` item, `agent: "adversarial-reviewer-sol"`, `name: "SmokePlan"`, context `Adversarial second-opinion review. OUTPUT is a file; INTENT states what it was for.`, task:
     ```
     Review OUTPUT against INTENT. SCOPE: artifacts: local://smoke-out.py (read whole); concerns: correctness against the plan contract; exclusions: everything else.
     BASE: none (no commits)
     OUTPUT: local://smoke-out.py
     CHECKS: none
     BASELINE_CHECKS: none
     PLAN: local://smoke-plan.md:18-22
     PLAN_DEVIATIONS: none
     KNOWN: none
     INTENT: "implement scale per the plan" — scale must follow the plan's contract.
     ```
     `solutionSpace`: `Defect cause open within SCOPE.` Then `wait`.
   - Pass: the report flags `smoke-out.py:2` (CRIT or WARN: adds instead of multiplying), and in `<session dir>/SmokePlan.jsonl` (session dir = `rows[0]["file"][:-6]` from `await archive.sessions(project="~/projects/omp-gated-pipeline", limit=1, silent=True)` in Python eval) a `read` of path `local://smoke-plan.md:18-22` precedes the first `read` of `local://smoke-out.py`.
4. Step 1 changes coordinator behavior only a live request for Opus-authored work exercises, and step 3 changes report wording; their Acceptance greps are the proof here. State that in the final report.
5. `git status --short` lists only `skills/parallel-fanout/SKILL.md`, `skills/adversarial-review/SKILL.md`, `skills/adversarial-review/reviewer.md`, `package.json`.

## Assumptions & contingencies

- Nothing is committed or pushed; the user reviews the diff first.
- If Verification 3 fails (no PLAN read before OUTPUT, or `scale` not flagged), keep the step 2 text and report the failure with the transcript lines; add no more instruction text in this run.
- Left unchanged by user decision: concurrent same-tree pipeline runs. Left unchanged for lack of evidence: SPEC_CONFLICT handling (unexercised this window), the Opus advisor on Sol reviewers (re-assess its unread-material notes after the `PLAN:` field ships), the preflight `UNLISTED_CALLER` word match (1 false positive in 62 runs).
