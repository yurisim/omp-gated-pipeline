---
name: adversarial-review
description: Main-session coordinator only; subagents never load this skill (reviewer agents read only skill://adversarial-review/reviewer.md). Hostile second-opinion review, scoped to the requested change, by a reviewer from the model family that did not write the work. Use after drafting code, content, or answers (plans only on explicit user request), before merging, or when a review felt too agreeable.
---

# Adversarial Review

> Running in Antigravity? Also read [antigravity.md](./antigravity.md) for reviewer subagent setup, tool/path mappings, and model-tier selection.

Run one review pass, scoped to what the user asked for, with reviewers whose model family did not write the work they review:
- `adversarial-reviewer` takes the files that only task-model agents wrote (`synth`, including fixes it applied on coordinator request, or a generic `task` agent).
- `adversarial-reviewer-alt` takes every file the coordinator or any other coordinator-model agent wrote or edited: wave-0 spec tests, inline edits (exempt single-file fixes, JSON-free serial plans, coordinator-owned or audit fixes), or text the plan gave `sonic` verbatim. Plans and answers are written by the coordinator, so they also take this agent.
- When both groups are non-empty, spawn both in one `task` batch, each with only its own files under SCOPE `artifacts:` and the same OUTPUT patch; that batch is the one review pass. Handle their findings together.
- A file both families edited before the review goes in both reviewers' `artifacts:`, each annotated with the hunks its author family did not write (for example `src/x.py (synth hunks: lines 40-180)`).

## Use / Skip

Use: post-draft code or answer before merge; a plan only when the user explicitly asks for a plan review; self-review said "looks good"; auth/payments/data/migrations/irreversible. Triggers: "second opinion", "adversarial review", "poke holes", "red-team this".
Skip: typo/format-only; open-ended brainstorming (review the converged proposal).

## Scope the review

Always pass:
- **INTENT**: the user's latest request quoted verbatim, then one sentence on what the output must achieve.
- **SCOPE**: three parts — `artifacts:` files/plan under review (plus untracked files to read whole); `concerns:` what to check, taken from the matching concern profile in skill://adversarial-review/reviewer.md (Scope gate); `exclusions:` surfaces the change does not touch.

## Prepare (code changes)

The reviewer has only `read`, `grep`, `glob`: no shell, no git, no tests. Hand it files it can read.

1. Baseline, before the first edit: when committing or splitting already-uncommitted work in the tree, record `BASE=$(git rev-parse HEAD)` (the commit before the series); otherwise record `BASE=$(git stash create)` and fall back to `BASE=$(git rev-parse HEAD)` if empty. In a repo with no commits both fail: state `BASE: none (no commits)` and list every in-scope file in SCOPE as untracked (read whole). Any check failure claimed as pre-existing MUST be reproduced on `$BASE` itself in a detached worktree (set up as the project's AGENTS.md pipeline section says) and saved to `local://<topic>-baseline-checks.md`; never run a "baseline" check on the modified working tree.
2. Timing: run the review after the repo's test suite and checks have run, not alongside them, so the reviewer can judge their failures. The wave-0 stage is the exception: it runs after `wave0-red` only.
3. Patch: save `git diff $BASE -- <scoped paths>` to `local://<topic>.patch`. New untracked files are not in that diff; list them in SCOPE for whole-file reading. When the deliverable is a commit or commit series, save `git log --stat -p $BASE..HEAD -- <scoped paths>` (excluding only lockfiles and generated artifacts >100 KB, e.g. `:!yarn.lock` `:!package-lock.json`, listed by path in SCOPE — never exclude source, test, or config files) to `local://<topic>.patch` so commit boundaries, messages, and hunk splits are reviewed.
4. Checks: save exact commands run, exit codes, verbatim failure output, `git status --short` output, and any commands/flags that differed from the approved plan (`planDeviations`) to `local://<topic>-checks.md`. When pre-existing check failures are claimed, also save the `$BASE` reproduction output to `local://<topic>-baseline-checks.md`. Do not write causal explanations or "predates change" claims in CHECKS — attribution is the reviewer's job. Run local test suites in local mode, not CI mode, when CI mode changes workers/retries (the project's AGENTS.md names such flags).
5. KNOWN: list only (a) tracked defects cited as `path:line` in the repo's requirements/defect docs (the project's AGENTS.md pipeline section names them), (b) behavior cited as `local://<slug>-plan.md:line` in an approved plan, and (c) check failures that reproduced verbatim on `$BASE` in `local://<topic>-baseline-checks.md`. Never list a failure in a newly added/modified test or a failure without `$BASE` reproduction in KNOWN.
6. PLAN: when the change executes an approved plan, list the plan line ranges the reviewer needs as one comma-joined selector, for example `local://<slug>-plan.md:117-167,480-482`: the `## Parallel waves` JSON of every slice whose files are under review, the Approach steps those slices implement, and every plan line KNOWN or PLAN_DEVIATIONS cites. Otherwise `none`. Keep the Invoke template's read-override sentence after a selector.

## Invoke

```json
{
  "context": "Adversarial second-opinion review. OUTPUT is a patch file; INTENT states what it was for.",
  "tasks": [{
    "agent": "<adversarial-reviewer or adversarial-reviewer-alt, chosen as above>",
    "task": "Review OUTPUT against INTENT. SCOPE: artifacts: <files; untracked files to read whole>; concerns: <from the concern profile>; exclusions: <untouched surfaces>.\nBASE: <resolved 40-hex sha>\nOUTPUT: local://<topic>.patch\nCHECKS: local://<topic>-checks.md\nBASELINE_CHECKS: local://<topic>-baseline-checks.md (or none)\nPLAN: <none, or: local://<slug>-plan.md:<ranges> (read this exact selector with one `read` even though the plan is inlined in your system prompt)>\nPLAN_DEVIATIONS: <verbatim list or none>\nKNOWN: <tracked defects and plan-mandated behavior, one per line>\nINTENT: <user request verbatim> — <what it was supposed to achieve>",
    "solutionSpace": "Defect cause open within SCOPE; reviewer reports in-scope breaks only."
  }]
}
```

Plans (only on explicit user request) and answers: OUTPUT is the plan path or the pasted answer; the patch does not apply, PLAN is `none`, and CHECKS is `none` unless the plan claims pre-existing check failures, in which case `BASE: <resolved 40-hex sha>` and `BASELINE_CHECKS: local://<topic>-baseline-checks.md` are required.

The returned report already includes the advisor's review (package README, "Required omp settings").

## Verdict (skeptical by default, never auto-fix)

- **Evidence bar:** CRITICAL proposes BLOCK only with `file:line` + repro / attack path / broken invariant. Any downgrade/dispute of a CRITICAL = Refute, stays BLOCK until user rules via `ask`.
- **Defender step:** per finding Accept (fix it) or Refute (counter-evidence only). No silent drops, no self-granted "risk accepted". The report after handling the review has one table row per CRIT, WARN, and CHECK `caused by patch`: `reviewer | finding | fixed / refuted / user: fix / user: dismiss | where (path:line) or counter-evidence`.
- **Cooldown:** one review pass per user request. Never re-run the review on fixes for its own (or the advisor's) findings; re-run the checks those fixes touch instead. A BLOCK clears when its patch-caused check passes or its CRITICAL is fixed.
- **BLOCK** (1+ CRITICAL or 1+ CHECK caused by patch, accepted or pending): fix before merge/use; never self-grant "risk accepted" on a failing check.
- **CONCERNS** (0 CRITICAL, 0 CHECK caused by patch, 1+ accepted warnings): fix or record risk acceptance.
- **CLEAN** (notes only, zero CRITICALs, every CHECK predates change): proceed.

## Contested → `ask`

Disagreement never self-clears. Present finding + refutation, call `ask` (fix / dismiss / downgrade), wait. No further work on disputed code until user answers.

## Barrier-gated changes

When skill://parallel-fanout ran the pipeline, the final review stage is the diff audit after a green integration barrier, by the agent chosen as above:
- OUTPUT: the `patch` path from the last passing integration barrier JSON. Untracked files from its `untracked` list go in SCOPE to be read whole.
- CHECKS: that barrier's `.json` and `.txt`, `wave0-red.json` when any slice has spec tests, every slice barrier JSON (or the exact acceptance command and result for `tests: []` or a JSON-free serial plan), plus `git status --short` and `planDeviations` in `local://<topic>-checks.md`. An explicitly recorded `no spec tests; no wave0-red.json` is valid only when every slice has `tests: []` or the plan is JSON-free serial; otherwise missing wave-0 evidence is not valid.
- SCOPE concerns add: drift between the diff and each slice spec (signatures, invariants, files outside `owns`); tests added or edited by a slice outside its `owns`; passing planned spec tests (including parametrized cases) from `wave0-red.json` `passed_ids`, recorded in `planDeviations` (they test nothing new; ignore unrelated existing tests from those files).
- Findings are fixed through `write agent://<owner implementation agent id>`, using OWNERS (slice id -> implementation agent id, `synth` or `sonic`), or by the coordinator. Group the accepted findings by owner and send each owner one message with all of its findings, every `write agent://<id>` call in the same response; then wait for all messaged owners to return. Keep instructions focused within `owns` with no extra tests. The coordinator runs a sonic owner's slice barrier or acceptance command as in skill://parallel-fanout section 3, then re-gates as `integrate-audit` (cooldown rules above still apply).
- No-barrier projects: OUTPUT is `local://<topic>.patch`; CHECKS are every slice's acceptance command and result plus `local://<topic>-integrate.txt`, `git status --short`, and `planDeviations`.

## Wave-0 review

When skill://parallel-fanout ran `wave0-red`, the coordinator-written wave-0 files (spec tests, contracts, helpers) are reviewed while wave 1 runs, as the first stage of the one review pass:
- Invoke `adversarial-reviewer-alt` with OUTPUT `local://<topic>-wave0.patch` (`git diff $BASE -- <wave-0 files>`; untracked wave-0 files in SCOPE to read whole), CHECKS `.scratch/barrier/wave0-red.json`, PLAN as in Prepare step 6, and SCOPE concerns: each spec test against its slice's `symbols` and `invariants`; a wrong implementation the tests would pass; tests that contradict each other or the plan.
- Fix accepted findings in the wave-0 files at once, rerun the changed ids as `<barrier> --label wave0-red-fix --expect red -- <ids>`, record the change in `planDeviations`, and send `Wave-0 fix: <what changed>. Rerun Turn 1.` with `write agent://<id>` to every synth whose `tests` include a changed id.
- The final stage gives `adversarial-reviewer-alt` only the coordinator-written files created or edited after `local://<topic>-wave0.patch` was saved; with none, only `adversarial-reviewer` runs.
