---
name: adversarial-review
description: Hostile second-opinion review, scoped to the requested change, by a reviewer from the model family that did not write the work. Use after drafting code, content, or answers (plans only on explicit user request), before merging, or when a review felt too agreeable.
---

# Adversarial Review

A reviewer with different weights breaks self-review blindness. Run one review pass, scoped to what the user asked for, with reviewers whose model family did not write the work they review:
- `adversarial-reviewer` (Opus, Sol advisor) takes the files that only Sol agents wrote (`synth`, or a `task` agent that ran on Sol).
- `adversarial-reviewer-sol` (Sol, Opus advisor) takes every file the coordinator or any other Opus agent wrote or edited: wave-0 spec tests, inline edits (exempt single-file fixes, JSON-free serial plans, coordinator-owned or audit fixes), text the plan gave `sonic` verbatim, or output of a `task` agent that ran on Opus. Plans and answers are written by the coordinator, so they also take this agent.
- When both groups are non-empty, spawn both in one `task` batch, each with only its own files under SCOPE `artifacts:` and the same OUTPUT patch; that batch is the one review pass. Handle their findings together.

## Use / Skip

Use: post-draft code or answer before merge; a plan only when the user explicitly asks for a plan review (plan-mode plans otherwise pass skill://plan-preflight and synth's Turn 1 Protocol, never a same-weights LLM review); self-review said "looks good"; auth/payments/data/migrations/irreversible. Triggers: "second opinion", "adversarial review", "poke holes", "red-team this".
Skip: typo/format-only; open-ended brainstorming (review the converged proposal).

## Scope the review

Reviews drift into surfaces the change never touched (e.g. UI and browser coverage on a content-only plan) when the task names only files. Always pass:
- **INTENT**: the user's latest request quoted verbatim, then one sentence on what the output must achieve.
- **SCOPE**: three parts — `artifacts:` files/plan under review (plus untracked files to read whole); `concerns:` what to check, taken from the matching concern profile in skill://adversarial-review/reviewer.md (Scope gate); `exclusions:` surfaces the change does not touch.
- Never add checklist items for surfaces the change does not touch (UI, browser/e2e coverage, security, production hardening).

Examples:
- Content change: `artifacts: docs/api.md, public/diagrams/flow.svg; concerns: source support, recomputed numbers, ambiguity, duplication, repo format spec, validation script, figure geometry; exclusions: UI, browser/e2e coverage, security, production hardening`.
- Code change: `artifacts: src/auth/session.ts, src/auth/session.spec.ts; concerns: Saboteur, New Hire, Security Auditor (trust boundary: session tokens); exclusions: unrelated modules, styling`.

## Prepare (code changes)

The reviewer has only `read`, `grep`, `glob`: no shell, no git, no tests. Hand it files it can read.

1. Baseline, before the first edit: when committing or splitting already-uncommitted work in the tree, record `BASE=$(git rev-parse HEAD)` (the commit before the series); otherwise record `BASE=$(git stash create)` and fall back to `BASE=$(git rev-parse HEAD)` if empty. In a repo with no commits both fail: state `BASE: none (no commits)` and list every in-scope file in SCOPE as untracked (read whole). Note the resolved sha in a todo. Any check failure claimed as pre-existing MUST be reproduced on `$BASE` itself in a detached worktree (set up as the project's AGENTS.md pipeline section says) and saved to `local://<topic>-baseline-checks.md`; never run a "baseline" check on the modified working tree.
2. Timing: run the review after the repo's test suite and checks have run, not alongside them, so the reviewer can judge their failures.
3. Patch: save `git diff $BASE -- <scoped paths>` to `local://<topic>.patch`. New untracked files are not in that diff; list them in SCOPE for whole-file reading. When the deliverable is a commit or commit series, save `git log --stat -p $BASE..HEAD -- <scoped paths>` (excluding only lockfiles and generated artifacts >100 KB, e.g. `:!yarn.lock` `:!package-lock.json`, listed by path in SCOPE — never exclude source, test, or config files) to `local://<topic>.patch` so commit boundaries, messages, and hunk splits are reviewed.
4. Checks: save exact commands run, exit codes, verbatim failure output, `git status --short` output, and any commands/flags that differed from the approved plan (`planDeviations`) to `local://<topic>-checks.md`. When pre-existing check failures are claimed, also save the `$BASE` reproduction output to `local://<topic>-baseline-checks.md`. Do not write causal explanations or "predates change" claims in CHECKS — attribution is the reviewer's job. Run local test suites in local mode, not CI mode, when CI mode changes workers/retries (the project's AGENTS.md names such flags).
5. KNOWN: list only (a) tracked defects cited as `path:line` in the repo's requirements/defect docs (the project's AGENTS.md pipeline section names them), (b) behavior cited as `local://<slug>-plan.md:line` in an approved plan, and (c) check failures that reproduced verbatim on `$BASE` in `local://<topic>-baseline-checks.md`. Never list a failure in a newly added/modified test or a failure without `$BASE` reproduction in KNOWN.

## Invoke

```json
{
  "context": "Adversarial second-opinion review. OUTPUT is a patch file; INTENT states what it was for.",
  "tasks": [{
    "agent": "<adversarial-reviewer or adversarial-reviewer-sol, chosen as above>",
    "task": "Review OUTPUT against INTENT. SCOPE: artifacts: <files; untracked files to read whole>; concerns: <from the concern profile>; exclusions: <untouched surfaces>.\nBASE: <resolved 40-hex sha>\nOUTPUT: local://<topic>.patch\nCHECKS: local://<topic>-checks.md\nBASELINE_CHECKS: local://<topic>-baseline-checks.md (or none)\nPLAN_DEVIATIONS: <verbatim list or none>\nKNOWN: <tracked defects and plan-mandated behavior, one per line>\nINTENT: <user request verbatim> — <what it was supposed to achieve>",
    "solutionSpace": "Defect cause open within SCOPE; reviewer reports in-scope breaks only."
  }]
}
```

Plans (only on explicit user request) and answers: OUTPUT is the plan path or the pasted answer; the patch does not apply, and CHECKS is `none` unless the plan claims pre-existing check failures, in which case `BASE: <resolved 40-hex sha>` and `BASELINE_CHECKS: local://<topic>-baseline-checks.md` are required.

Notes: both agents load their instructions from skill://adversarial-review/reviewer.md and are read-only (`read`, `grep`, `glob`). Each pairs with an advisor from the other family that second-guesses every turn: `adversarial-reviewer` runs on `@slow` with `advisor: true` (the `advisor` model role); `adversarial-reviewer-sol` runs on `openai-codex/gpt-6.1-sol:max` with `advisor: "@slow"`. Override either advisor via `task.agentAdvisor`.

## Verdict (skeptical by default, never auto-fix)

- **Evidence bar:** CRITICAL proposes BLOCK only with `file:line` + repro / attack path / broken invariant. Any downgrade/dispute of a CRITICAL = Refute, stays BLOCK until user rules via `ask`.
- **Defender step:** per finding Accept (fix it) or Refute (counter-evidence only). No silent drops, no self-granted "risk accepted". In the report after handling the review, post one disposition line per CRIT, WARN, and CHECK `caused by patch`, in the reviewer's order: `Accept <SEV> <file:line> — fixed at <path:line or plan step>` or `Refute <SEV> <file:line> — <counter-evidence path:line or CHECKS quote>`. One line per NOTE: `Accept …` or `Skip — <reason>`.
- **Cooldown:** one review pass per user request. Never re-run the review on fixes for its own (or the advisor's) findings; re-run the checks those fixes touch instead. A BLOCK clears when its patch-caused check passes or its CRITICAL is fixed. The next review is due with the next review-eligible user request (code or answer per Use / Skip).
- **BLOCK** (1+ CRITICAL or 1+ CHECK caused by patch, accepted or pending): fix before merge/use; never self-grant "risk accepted" on a failing check.
- **CONCERNS** (0 CRITICAL, 0 CHECK caused by patch, 1+ accepted warnings): fix or record risk acceptance.
- **CLEAN** (notes only, zero CRITICALs, every CHECK predates change): proceed.

## Contested → `ask`

Disagreement never self-clears. Present finding + refutation, call `ask` (fix / dismiss / downgrade), wait. No further work on disputed code until user answers.

## Barrier-gated changes

When skill://parallel-fanout ran the pipeline, the review is the single diff audit after a green integration barrier, by the agent chosen as above:
- OUTPUT: the `patch` path from the last passing integration barrier JSON (`.scratch/barrier/integrate.patch` or `integrate-retry.patch`). Untracked files from its `untracked` list go in SCOPE to be read whole.
- CHECKS: that barrier's `.json` and `.txt`, `wave0-red.json` when any slice has spec tests, every slice barrier JSON (or the exact acceptance command and result for `tests: []` or a JSON-free serial plan), plus `git status --short` and `planDeviations` in `local://<topic>-checks.md`. An explicitly recorded `no spec tests; no wave0-red.json` is valid only when every slice has `tests: []` or the plan is JSON-free serial; otherwise missing wave-0 evidence is not valid.
- SCOPE concerns add: drift between the diff and each slice spec (signatures, invariants, files outside `owns`); tests added or edited by a slice outside its `owns`; passing planned spec tests (including parametrized cases) from `wave0-red.json` `passed_ids`, recorded in `planDeviations` (they test nothing new; ignore unrelated existing tests from those files).
- Findings are fixed through `write agent://<owner implementation agent id>`, using OWNERS (slice id -> implementation agent id, `synth` or `sonic`), or by the coordinator. Send focused instructions within `owns` with no extra tests; wait for the mapped owner to return. The coordinator runs a sonic owner's slice barrier or acceptance command as in skill://parallel-fanout section 3, then re-gates as `integrate-audit` (cooldown rules above still apply).
- No-barrier projects: OUTPUT is `local://<topic>.patch`; CHECKS are every slice's acceptance command and result plus `local://<topic>-integrate.txt`, `git status --short`, and `planDeviations`.
