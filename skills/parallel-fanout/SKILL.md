---
name: parallel-fanout
description: "Main-session coordinator only; subagents never load this skill. Auto-fan independent work into one parallel task batch without being asked."
---

# parallel-fanout - parallel execution skill

Trigger: any task decomposable into 2+ slices. Do not wait to be asked. If work looks serial, replan it into parallel shape before executing serially. If replanning does not yield a parallel shape, execute serially.

Fan when ALL hold: disjoint mutable scope per slice (files, modules, features); execution-independent within wave (no sibling output needed at runtime); shared contracts (interfaces, schemas, file ownership, no-touch zones) definable up front.

## 0. Baseline

Before the first edit, record `BASE=$(git stash create)` (empty output, or when committing/splitting already-uncommitted work: use `BASE=$(git rev-parse HEAD)`). It snapshots pre-existing uncommitted work without touching the tree or the stash list, so `git diff $BASE` later shows only this change. In a repo with no commits yet both commands fail: note `BASE: none (no commits)` and treat every file as untracked. When any post-integration check fails and is suspected to predate the wave, reproduce it in a detached worktree at `$BASE`, set up as the project's AGENTS.md pipeline section says, and save the output to `local://<topic>-baseline-checks.md` before classifying the failure as pre-existing. See skill://adversarial-review.

## 1. Plan for maximum parallelism

Shape the plan to create the trigger: extract shared contracts first and inline them; split by disjoint writes, one slice per owner; define slice interfaces (inputs/outputs, acceptance); order as contracts -> one `tasks[]` batch per dependency-ready wave -> integration. Sequence ONLY true dependencies (consumers after providers, integration after slices).

Write the waves into the plan's `## Parallel waves` section:
- Wave 0: shared contracts plus every spec test, given verbatim in the plan; the coordinator writes them before spawning.
- Each later wave: one fenced `json` array of slice specs, one object per slice:
  `{"id": "S1", "agent": "synth"|"sonic", "owns": ["path"], "reads": ["path"], "symbols": [{"path": "...", "name": "Class.method", "signature": "method(n: number): string", "contract": "one line"}], "invariants": ["..."], "tests": ["<test id in the project's format>"], "acceptance": "barrier label S1 green"}`
- Tag every path in `owns`, `reads`, or `symbols[].path`, and every symbol `name`, that the plan creates with a leading `[NEW] ` (for example `"[NEW] src/app/x.ts"` or `"name": "[NEW] parseWave"`). Untagged paths and symbols must already exist. List every file that references a symbol whose `signature` the plan changes in some slice's `owns` or `reads`. skill://plan-preflight enforces both.
- `tests` lists barrier test ids, in the format the project's AGENTS.md pipeline section defines, that the architect wrote in wave 0. Each id names one concrete test (a parametrized or loop case by its generated title), never a bare file. Only the architect writes tests: behavior, boundaries, invariants, errors; never wiring or mocks of internals. A slice with nothing testable (docs, config, content), or any slice in a project without a barrier, lists `[]` and gives an exact acceptance command instead (AGENTS.md may name one per artifact type).
- `agent` is `synth` (Sol) for every slice that edits code, scripts, tests, or build config: the plan gives it contracts (`symbols`, `invariants`, `tests`), never implementation code. Use `sonic` only for non-code edits (docs, instructions, content) whose exact text the plan gives.
- Size each slice so `owns` + `reads` stays under ~200K tokens (bytes / 4); split larger slices so Sol's context stays small.
- Last wave: work that needs integrated output, such as docs citing final line numbers.
- Serial plans ("Serial: <reason>") still give the slice JSON and wave-0 tests and run in order through the same barrier gates. Exception: a serial plan that is one slice with no spec tests and no code, script, test, or build-config edits writes only `Serial: <reason>` and `Acceptance: <exact command>`, each on its own line outside any fence, and no JSON. The coordinator executes it inline (no `task` batch, no `synth`/`sonic`), runs that acceptance command, then the integration gate (`<barrier> --label integrate --base $BASE --full`, or the no-barrier integration command). When every file changed since `$BASE` (`git diff --name-only $BASE` plus `git ls-files --others --exclude-standard`) is documentation that no code, test or build reads, the coordinator skips the integration gate and records `docs-only; no integration gate` with that file list in CHECKS; the plan's own docs-only claim is not enough. On a failed gate the coordinator fixes it and reruns that gate once; a second failure stops the pipeline and is reported.
- Before proposing the plan, and again before spawning wave 1, run skill://plan-preflight on the plan file; spawn only on `pass`.

Executing a plan that lacks the section: add it to the plan file first, then spawn.

Balance slices: the slowest slice sets the wave's wall time. Once its contract is fixed, split any slice that owns far more files than its siblings (for example model/catalog code vs templates/specs).

## 2. Fan out

Barrier: the project's AGENTS.md pipeline section names the command (`<barrier>` below) and any project rules for ports, environment, and wave-0 selection. Every barrier honors this contract:
- `<barrier> --label <label> [--expect red] [--base $BASE] (--full | -- <quoted test ids>)`; exit 0 exactly when the verdict is `pass`.
- It writes `.scratch/barrier/<label>.json` (at least `verdict`, `passed`, `passed_ids`, `failed`, `base`, `patch`, `untracked`, `trace`) and the `<label>.txt` trace. `--base` adds the `git diff $BASE` patch and the untracked list.
- With test ids it judges only the listed ids; `--full` runs the project's full build and every test suite.

1. Wave 0: write contracts and spec tests verbatim.
   - If any slice has spec tests, run `<barrier> --label wave0-red --expect red -- <every planned test id>`, unless the project's AGENTS.md prescribes a different wave-0 selection.
   - `wave0-red` must return `pass`. A `fail` caused only by planned spec tests that already pass (`passed_ids`) follows the already-green policy: record those planned spec tests in `planDeviations` (the audit judges them), then continue. Any other `fail` (per the project's AGENTS.md: ids matching no test, a runner without a report, a collection error) is a broken wave 0: fix it before spawning.
   - If every slice has `tests: []`, skip `wave0-red` entirely, record `no spec tests; no wave0-red.json` in CHECKS, and proceed with the slices' exact acceptance commands.
2. Each later wave: one `tasks[]` batch, one item per slice.
   - The batch `context` carries the wave-0 contracts, the BASE sha, and the project's barrier command (or its no-barrier acceptance rules).
   - Each item's `task` is that slice's JSON verbatim, and its `agent` comes from the spec.
   - Never use the generic `task` agent for an implementation slice: it lacks `synth`'s output schema and Turn 1 gate. It runs on the `task` model role (the role `synth` uses; the parent's model only when `modelRoles.task` is unset), and per-call `model` overrides are off by default. When the user explicitly asks for Claude-authored work, the coordinator writes it inline, except in a file a `synth` slice owns during a run: section 3 "Owner edits" still applies, so tell the user that change goes to the owning synth (Sol).
3. `synth` runs its Turn 1 Protocol (feasibility gate), then returns its structured schema (edits, lines, planDeviations, checks, specConflict) and runs its own slice barrier or acceptance command.
   - After a `sonic` slice returns, the coordinator runs `<barrier> --label <id> -- <its tests>` (or its acceptance command when `tests` is `[]`).
   - Never pad batches, and never fan slices that share mutable files without a single owner.
   - Slices never use `--full` or the dependency-changing commands the project's AGENTS.md forbids.

## 3. Collect and gate

Keep working while siblings run. Collect with `wait`. Apply every `planDeviations` entry to dependent artifacts before gating.

Owner edits: from the wave 1 spawn until the review is spawned, every change to a file in a `synth` slice's `owns` (integration fixes, live-run fixes, user-requested tweaks) goes to that synth with `write agent://<id>`: what to change and why (the observed failure or the user's request), plus `No new tests; do not edit tests.` Wait for it to return; synth rule 7 reruns its slice gate. Never edit those files inline, even for a one-line fix, so every file has one author family for review routing. If `write agent://<id>` fails because the agent no longer exists, spawn one `synth` whose `task` is the original slice JSON and whose `context` starts with `Slice already implemented in the tree; apply only this fix:` followed by the change. Files the coordinator owns (wave-0 contracts and spec tests, docs the plan leaves to the coordinator, `sonic` text) stay coordinator-edited.

Progress: mirror the plan's waves in `todo`. Use phases `Wave 0`, `Wave 1` … `Wave N` (one per wave in `## Parallel waves`), then `Integration`. Each slice gets one item named by outcome, `<id>: <what it delivers>` (for example `S2: agent integration`), never by action (`Spawn S2`). Wave 0 items are the contract and spec-test writes that the plan actually has, plus `wave0-red` only when it runs (no item when it is skipped). A JSON-free serial plan has no wave phases: one item for the inline change, then `Integration`. Mark a slice item `done` once its result is collected and its slice gate passes, in the same response as your next tool call. Close every item of a wave before spawning the next wave; never batch-close items at the end of the run.

Spec conflicts: a `synth` that returns a non-empty `specConflict` made no edits. Read each cited `file:line`. When every cited line is in a wave-0 artifact the coordinator wrote (contract, spec test, helper script) and the plan's intent is unambiguous, fix that artifact, rerun the check that covers it (`wave0-red` for a spec test), record the change in `planDeviations`, and send `Wave-0 fix: <what changed>. Rerun Turn 1.` to the synth with `write agent://<id>`. Otherwise `ask` the user with the `SPEC_CONFLICT` lines and what you found; after the user decides, patch the plan, rerun skill://plan-preflight, and send the corrected slice JSON to the same synth with `write agent://<id>`.

Slice gate, after the whole wave has returned: a slice is accepted when its last barrier verdict (or acceptance command) passed.

Integration gate, after the last wave: `<barrier> --label integrate --base $BASE --full`. `pass` goes to the audit (skill://adversarial-review, section "Barrier-gated changes").

No-barrier projects (the AGENTS.md pipeline section names no barrier command): slice gates are their acceptance commands. The integration gate is the section's integration command: save its output to `local://<topic>-integrate.txt` and `git diff $BASE` to `local://<topic>.patch`; exit 0 is `pass`. The audit uses `local://<topic>.patch` as OUTPUT.

Failed gate (one retry per pipeline run):
1. Send the failure with `write agent://<id>` to the implementation agent that owns the failing code: the failed test ids and the barrier `.json`/`.txt` (no-barrier: the command, exit code, and saved output), plus focused fix instructions inside its `owns`. Forbid new tests and any edit, deletion, skip, or loosening of spec tests. A failure in a wave-0 contract or spec test is the coordinator's to fix.
2. Wait for it to return, then rerun the failed gate once with a `-retry` label suffix (no-barrier: the same command). For a `sonic` owner, first rerun its slice barrier or acceptance command.
3. A second failure, or a failure no single owner can fix, stops the pipeline: `ask` the user with the gate output. No audit.

Audit fixes are re-gated with `--label integrate-audit --base $BASE --full` (no-barrier: the integration command). A `fail` there stops the pipeline: `ask` the user with its output.

When the user says `parallel`/`parallelize`, MUST use `task` subagents - parallel tool calls alone are insufficient.
