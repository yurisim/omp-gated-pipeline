---
name: parallel-fanout
description: "Auto-fan independent work into one parallel task batch without being asked."
---

# parallel-fanout - parallel execution skill

Trigger: any task decomposable into 2+ slices. Do not wait to be asked. If work looks serial, replan it into parallel shape before executing serially. If replanning does not yield a parallel shape, execute serially.

Fan when ALL hold: disjoint mutable scope per slice (files, modules, features); execution-independent within wave (no sibling output needed at runtime); shared contracts (interfaces, schemas, file ownership, no-touch zones) definable up front.

## 0. Baseline

Before the first edit, record `BASE=$(git stash create)` (empty output, or when committing/splitting already-uncommitted work: use `BASE=$(git rev-parse HEAD)`) and note the resolved sha in a todo so it survives compaction. It snapshots pre-existing uncommitted work without touching the tree or the stash list, so `git diff $BASE` later shows only this change. In a repo with no commits yet both commands fail: note `BASE: none (no commits)` and treat every file as untracked. When any post-integration check fails and is suspected to predate the wave, reproduce it in a detached worktree at `$BASE`, set up as the project's AGENTS.md pipeline section says, and save the output to `local://<topic>-baseline-checks.md` before classifying the failure as pre-existing. See skill://adversarial-review.

## 1. Plan for maximum parallelism

Shape the plan to create the trigger: extract shared contracts first and inline them; split by disjoint writes, one slice per owner; define slice interfaces (inputs/outputs, acceptance); order as contracts -> one `tasks[]` batch per dependency-ready wave -> integration. Sequence ONLY true dependencies (consumers after providers, integration after slices).

Write the waves into the plan's `## Parallel waves` section:
- Wave 0: shared contracts plus every spec test, given verbatim in the plan; the coordinator writes them before spawning.
- Each later wave: one fenced `json` array of slice specs, one object per slice:
  `{"id": "S1", "agent": "synth"|"sonic", "owns": ["path"], "reads": ["path"], "symbols": [{"path": "...", "name": "Class.method", "signature": "method(n: number): string", "contract": "one line"}], "invariants": ["..."], "tests": ["<test id in the project's format>"], "acceptance": "barrier label S1 green"}`
- Tag every path in `owns`, `reads`, or `symbols[].path`, and every symbol `name`, that the plan creates with a leading `[NEW] ` (for example `"[NEW] src/app/x.ts"` or `"name": "[NEW] parseWave"`). Untagged paths and symbols must already exist. List every file that references a symbol whose `signature` the plan changes in some slice's `owns` or `reads`. skill://plan-preflight enforces both.
- `tests` lists barrier test ids, in the format the project's AGENTS.md pipeline section defines, that the architect wrote in wave 0. Each id names one concrete test (a parametrized or loop case by its generated title), never a bare file. Only the architect writes tests: behavior, boundaries, invariants, errors; never wiring or mocks of internals. A slice with nothing testable (docs, config, content), or any slice in a project without a barrier, lists `[]` and gives an exact acceptance command instead (AGENTS.md may name one per artifact type).
- `agent` is `synth` (Sol) by default. Use `sonic` only when the plan gives the exact code.
- Size each slice so `owns` + `reads` stays under ~200K tokens (bytes / 4); split larger slices so Sol's context stays small.
- Last wave: work that needs integrated output, such as docs citing final line numbers.
- Serial plans ("Serial: <reason>") still give the slice JSON and wave-0 tests and run in order through the same barrier gates. Exception: a serial plan that is one slice with no spec tests writes only `Serial: <reason>` and `Acceptance: <exact command>`, each on its own line outside any fence, and no JSON. The coordinator executes it inline (no `task` batch, no `synth`/`sonic`), runs that acceptance command, then the integration gate (`<barrier> --label integrate --base $BASE --full`, or the no-barrier integration command). On a failed gate the coordinator fixes it and reruns that gate once with the `-retry` suffix; a second failure stops the pipeline and is reported. The critic loop does not apply.
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
   - Never use the generic `task` agent for an implementation slice: it inherits the parent's model.
3. `synth` runs its Turn 1 Protocol (feasibility gate), then returns its structured schema (edits, lines, planDeviations, checks, specConflict) and runs its own slice barrier or acceptance command.
   - After a `sonic` slice returns, the coordinator runs `<barrier> --label <id> -- <its tests>` (or its acceptance command when `tests` is `[]`).
   - Never pad batches, and never fan slices that share mutable files without a single owner.
   - Slices never use `--full` or the dependency-changing commands the project's AGENTS.md forbids.

## 3. Collect and gate

Keep working while siblings run. Collect with `wait`. Apply every `planDeviations` entry to dependent artifacts before gating.

Spec conflicts (synth's Turn 1 Protocol):
- A synth that returns a non-empty `specConflict` made no edits. Read each cited `file:line`.
- Real conflict: patch the slice spec in the plan file (and the wave-0 contract or spec test when the conflict lies there), rerun skill://plan-preflight, then send the corrected slice JSON to the same synth with `write agent://<id>` and wait for it. If the fix changed a wave-0 contract or spec test, first rerun `wave0-red` on the changed test ids, include the changed contract in the message, and re-dispatch the same way any already-returned sibling whose `reads` or `symbols` use that contract.
- If the fix needs a design or scope decision, or the same slice returns a second `specConflict`, stop and `ask` the user with the conflict lines.
- Refuted conflict (the cited line does not show the contradiction): send the unchanged spec with a one-line refutation citing `file:line`; this counts as that slice's one re-dispatch.
- Spec-conflict handling never consumes the pipeline's single critic retry.

Slice gate, after the whole wave has returned:
- A slice is accepted when its last barrier verdict (or acceptance command) passed.
- A failed slice with non-empty `tests` gets one coordinator rerun of its barrier, `--label <id>-rerun`, because siblings' half-finished edits can break a run mid-wave.
- If that tests-backed rerun still fails, it takes the pipeline's single retry: run the critic loop below with BARRIER `.scratch/barrier/<id>-rerun.json`, then rerun as `<id>-retry`. A failure there stops the pipeline.
- For `tests: []`, if the initial acceptance command failed, the coordinator reruns that exact command once after the wave. If it still fails, stop and report the exact command, exit code, and output. Never run the barrier without test ids or `--full`, fabricate a barrier JSON, or invoke the critic for an acceptance-only failure without a failed BARRIER.

Integration barrier, after the last wave: `<barrier> --label integrate --base $BASE --full`.
- `pass`: go to the audit (skill://adversarial-review, section "Barrier-gated changes").
- `fail`: run the critic loop, unless the pipeline's single retry is already spent. In that case stop and report.

No-barrier projects (the AGENTS.md pipeline section names no barrier command): slice gates are their acceptance commands. The integration gate is the section's integration command: save its output to `local://<topic>-integrate.txt` and `git diff $BASE` to `local://<topic>.patch`; exit 0 is `pass`. On `fail`, the critic loop runs with GATE (command, exit code, those two files) in place of BARRIER, and the retry reruns the same command. The audit uses `local://<topic>.patch` as OUTPUT.

Critic loop (at most once per pipeline run):
1. Spawn one `critic` with BARRIER (the failed barrier JSON), SPECS (all slice JSON), and OWNERS (slice id -> implementation agent id, for either `synth` or `sonic`).
2. If `escalate` is true, or `owner` is `coordinator` and the fix touches a spec test, stop: report the diagnosis and trace to the user via `ask`.
3. Otherwise resolve the owner through OWNERS and dispatch with `write agent://<owner implementation agent id>`:
   - For `synth`, send the critic's JSON to the warm owner, then wait for it to return.
   - For `sonic`, send the exact focused critic instructions and the slice's `owns` list to that same sonic owner. Require edits only inside `owns`, no extra tests, and no edits, deletions, skips, or loosening of spec tests. Wait for it to return; the coordinator runs its checks.
   - A coordinator-owned contract fix is applied by the coordinator itself.
4. Rerun the failed gate with the `-retry` suffix (`integrate-retry`, with `--base $BASE --full`).
   - For a `sonic` owner, the coordinator first reruns its slice barrier with the exact spec test ids as `<id>-retry`, or its exact acceptance command when `tests` is `[]`. A failure stops the pipeline; for an acceptance-command failure, report the exact command, exit code, output, and critic diagnosis rather than inventing a barrier JSON or invoking another critic. If this was the failed gate, use that result rather than running it twice; otherwise rerun the failed gate only after the slice passes. These checks are part of the same single retry.
5. A second `fail` stops the pipeline: report that barrier JSON, its trace, and the critic diagnosis to the user. No third attempt and no audit.

Audit fixes are re-gated with `--label integrate-audit --base $BASE --full`. A `fail` there gets no critic: stop and report it to the user via `ask`.

When the user says `parallel`/`parallelize`, MUST use `task` subagents - parallel tool calls alone are insufficient.
