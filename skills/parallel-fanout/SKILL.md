---
name: parallel-fanout
description: "Main-session coordinator only; subagents never load this skill. Auto-fan independent work into one parallel task batch without being asked."
---

# parallel-fanout - parallel execution skill

> Running in Antigravity? Also read [antigravity.md](./antigravity.md) for tool, path, subagent, and model-tier mappings.

Replan apparently serial work before running it serially. Fan out when 2+ slices have disjoint writes, need no sibling output within a wave, and can agree up front on interfaces, schemas, ownership, and no-touch zones.

## 0. Baseline

Before the first edit, record `BASE=$(git stash create)` (empty output, or when committing/splitting already-uncommitted work: use `BASE=$(git rev-parse HEAD)`). It snapshots pre-existing uncommitted work without touching the tree or the stash list, so `git diff $BASE` later shows only this change. In a repo with no commits yet both commands fail: note `BASE: none (no commits)` and treat every file as untracked. Before calling any check failure pre-existing, reproduce it on `$BASE` as skill://adversarial-review Prepare step 1 says.

## 1. Plan for maximum parallelism

Define shared contracts and each slice's inputs, outputs, and acceptance up front. Run contracts → one `tasks[]` batch per dependency-ready wave → integration; sequence only true dependencies.

Write the waves into the plan's `## Parallel waves` section:
- Wave 0: shared contracts plus every spec test, given verbatim in the plan; the coordinator writes them before spawning.
- Each later wave: one fenced `json` array of slice specs, one object per slice:
  `{"id": "S1", "agent": "synth", "owns": ["path"], "reads": ["path"], "symbols": [{"path": "...", "name": "Class.method", "signature": "method(n: number): string", "contract": "one line"}], "invariants": ["..."], "tests": ["<test id in the project's format>"], "acceptance": "barrier label S1 green"}`
- Tag every path in `owns`, `reads`, or `symbols[].path`, and every symbol `name`, that the plan creates with a leading `[NEW] ` (for example `"[NEW] src/app/x.ts"` or `"name": "[NEW] parseWave"`). Untagged paths and symbols must already exist. List every file that references a symbol whose `signature` the plan changes in some slice's `owns` or `reads`. skill://plan-preflight enforces both.
- `tests` lists barrier test ids, in the format the project's AGENTS.md pipeline section defines, that the architect wrote in wave 0. Each id names one concrete test (a parametrized or loop case by its generated title), never a bare file. Only the architect writes tests: behavior, boundaries, invariants, errors; never wiring or mocks of internals. A slice with nothing testable (docs, config, content), or any slice in a project without a barrier, lists `[]` and gives an exact acceptance command instead (AGENTS.md may name one per artifact type).
- `agent` is `synth` for every slice that edits code, scripts, tests, or build config: the plan gives it contracts (`symbols`, `invariants`, `tests`), never implementation code. Use `sonic` only for non-code edits (docs, instructions, content) whose exact text the plan gives.
- Size each slice so `owns` + `reads` stays under ~200K tokens (bytes / 4); split larger slices so the slice's context stays small.
- Last wave: work that needs integrated output, such as docs citing final line numbers.
- Serial plans ("Serial: <reason>") still give the slice JSON and wave-0 tests and run in order through the same barrier gates. Exception: a serial plan that is one slice with no spec tests and either no code, script, test, or build-config edits, or such edits in one file totalling about 30 changed lines or fewer, writes only `Serial: <reason>` and `Acceptance: <exact command>`, each on its own line outside any fence, and no JSON. The coordinator executes it inline (no `task` batch, no `synth`/`sonic`), runs that acceptance command, then the integration gate (`<barrier> --label integrate --base $BASE --full`, or the no-barrier integration command). When every file changed since `$BASE` (`git diff --name-only $BASE` plus `git ls-files --others --exclude-standard`) is documentation that no code, test or build reads, the coordinator skips the integration gate and records `docs-only; no integration gate` with that file list in CHECKS; the plan's own docs-only claim is not enough. On a failed gate the coordinator fixes it and reruns that gate once; a second failure stops the pipeline and is reported.
- Before proposing the plan, and again before spawning wave 1, run skill://plan-preflight on the plan file; spawn only on `pass`.

Balance waves by splitting oversized slices once their contracts are fixed: the slowest slice sets wall time. Split any slice owning 4+ files into slices of 3 or fewer, even in a single-slice plan. If its files cannot change apart (signature and callers, rename, generated set), keep it whole and add `"coupling": "<one-line reason>"` to its JSON.

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
   - The batch `context` carries wave-0 contracts, the BASE sha, and the project's barrier command or no-barrier acceptance rules.
   - Each item's `task` is the slice JSON verbatim, `agent` comes from the spec, and `name` is the slice id.
   - Never use the generic `task` agent for an implementation slice: it lacks `synth`'s output schema and Turn 1 gate. When the user explicitly asks for coordinator-authored work in a file a `synth` slice owns during a run, section 3 "Owner edits" still applies: tell the user that change goes to the owning synth.
   - When `wave0-red` ran, spawn the wave-0 review (skill://adversarial-review, "Wave-0 review") in the same response as the wave 1 batch; for an isolated wave, finish that review first (section 3 "Isolated wave (trial)").
   - Only when the user asks for an isolated wave, add `"isolated": true` to every `synth` item of the batch and follow section 3 "Isolated wave (trial)".
3. `synth` runs its Turn 1 Protocol (feasibility gate) and its own slice barrier or acceptance command.
   - The coordinator gates `sonic` slices (§3).
   - Never pad batches.

## 3. Collect and gate

While slices run, do only coordinator-owned work already due. When none is left, end the turn; slice results and messages wake it. Never call `wait` to poll. Apply every `planDeviations` entry to dependent artifacts before gating. For a result arriving before the wave finishes, run its `sonic` gate if applicable, then end with one line naming what is still running, not a result summary.

**Owner edits:** Keep `OWNERS` (slice id → current implementation agent id) from wave 1 spawn through the final audit gate. Route all changes within `synth` ownership to that owner, never inline, to preserve review routing by author family. The coordinator edits wave-0 artifacts, its own docs, and `sonic` text except when routing an advisory, gate failure, or audit finding to the `sonic` owner.

- Send one `write agent://<id>` per owner with all their fixes, in the same response, then wait for all replies. Specify only work within `owns`, quote user requests or cite evidence, and include `No new tests; do not edit tests.` Never delete, skip, or loosen spec tests. If an owner is gone, `ask` the user. For isolated owners, use the replacement procedure below.
- **Cite, never retype:** Give the source path or id (`.scratch/barrier/<label>.json` and `.txt`, `local://<topic>-checks.md`, `agent://<reviewer id>`) and the exact items to act on (test ids, `ADV<n>` ids, or `CRIT`/`WARN` `file:line` headers). Add only instructions not already in the source's `fix:`. Never paste or paraphrase reports, traces, or findings. Agents can read `local://` files and `agent://<id>` reports.
- **Slice re-gates:** `synth` reruns its gate (synth rule 7). On initial return or after an owner fix, the coordinator gates `sonic` with `<barrier> --label <id> -- <its tests>` or its acceptance command. If retrying that slice's own gate, count the retry as its re-gate.

Advisories (`<advisory ...>`), from wave 1 spawn to the integration gate: log valid items in `local://<topic>-checks.md` as `ADV<n>: <owner slice id> - <what to change>`. After the whole wave returns and before integration, route them under Owner edits (e.g. `Apply ADV2 and ADV5 from local://<topic>-checks.md`). If an advisory shows a running slice's spec would fail its gate or require edits outside `owns`, handle it immediately as a spec conflict.

Stall check: in OMP, when `omp-swarm` is enabled, passive zero-token stall alerts run automatically. Otherwise, start a timer only if the user requests stall monitoring or the wave is suspected stalled. Run `bash` with `{"command": "sleep 900", "async": true, "timeout": 960}` and keep its job id. If the last slice returns first, cancel via `write proc://<job id>/kill` (empty `content`) in the same response as the next action. If the timer fires first, `read history://` once: a slice still `running` with `last activity` at least 10 minutes old is stalled. Log `stall check <n>: running <slice ids>; stalled <ids or none>` in `local://<topic>-checks.md`. On two consecutive stalled firings for a slice, or any slice still running at the third firing, `ask` the user with the `history://` rows; start no timer. Otherwise, in one response message each stalled slice `Stall check: continue your slice and yield when done.`, restart the timer, and end the turn.

Isolated wave (trial): runs only when the user asks for an isolated wave. Each `synth` item then carries `"isolated": true` and works in its own copy of the repository, so siblings never see each other's unfinished edits; `sonic` items stay shared. When the `task` tool rejects `isolated` (`task.isolation.enabled` is off), run the wave shared and record `isolated trial: unavailable` in CHECKS. The trial also needs omp's auto-apply (`task.isolation.apply` not set to `false`). Differences from a shared wave:
- An isolated copy never sees wave-0 changes made after its spawn. When `wave0-red` ran, run the wave-0 review, apply its fixes, and pass `wave0-red-fix` before spawning the isolated wave, not in the same response.
- omp applies each slice's patch to the working tree before it delivers the result. A result whose merge summary says `Patches were not applied`, `Branch merge failed`, `Not applied`, or `Not merged`, or reports a failed capture, did not land: `ask` the user with the artifact paths it names before any gate, and never apply or resolve it by hand.
- The slice's barrier files stay in its copy. After the whole wave has returned, the coordinator reruns every isolated slice's gate in the working tree, `<barrier> --label <id> -- <its tests>` (or its acceptance command when `tests` is `[]`); that verdict is the slice gate.
- Never send follow-ups to an isolated copy. Hold fixes until it lands, then spawn one shared `synth` via `task` with the verbatim slice JSON followed by `FIX: <Owner edits instructions>`. Update `OWNERS` to the new agent id. For a `specConflict`, instead respawn isolated with the corrected JSON (or unchanged JSON after a wave-0 fix).
- Record `isolated trial: <n> slices; not landed: <ids or none>; replacement synths: <n>` in CHECKS.

Spec conflicts: a `synth` that returns a non-empty `specConflict` made no edits. Read each cited `file:line`. When every cited line is in a wave-0 artifact the coordinator wrote (contract, spec test, helper script) and the plan's intent is unambiguous, fix that artifact, rerun the check that covers it (`wave0-red` for a spec test), record the change in `planDeviations`, and send `Wave-0 fix: <what changed>. Rerun Turn 1.` to the synth with `write agent://<id>`. Otherwise `ask` the user with the `SPEC_CONFLICT` lines and what you found; after the user decides, patch the plan, rerun skill://plan-preflight, and send the corrected slice JSON to the same synth with `write agent://<id>`.

Slice gate, after the whole wave has returned: a slice is accepted when its last barrier verdict (or acceptance command) passed.

Integration gate, after the last wave: `<barrier> --label integrate --base $BASE --full`. `pass` goes to the audit (skill://adversarial-review, section "Barrier-gated changes").

Plan verification, after a green integration gate and before the review: run every step of the plan's `## Verification` section that no gate already ran (live runs, browser or UI checks, rendered output). A step that is one self-contained command, needing no process, port, or login that only the coordinator session holds and writing nothing in the repository as written, goes to a generic `task` agent: spawn all such steps in one `task` batch, one agent per step, each told to run the command as written, write nothing in the repository (throwaway scripts go in a `mktemp -d` directory), and return the exact command, the exit code, and the part of the output that shows the result (the full output on a non-zero exit). The coordinator runs the remaining steps itself. Record each step in `local://<topic>-checks.md` with its command or action and the observed result, or as `not run - <reason>`, and repeat every `not run` line in the final report. A failing step is fixed through Owner edits, then the integration gate reruns as `integrate-verify` and the review uses that gate's patch.

No-barrier projects (the AGENTS.md pipeline section names no barrier command): slice gates are their acceptance commands. The integration gate is the section's integration command: save its output to `local://<topic>-integrate.txt` and `git diff $BASE` to `local://<topic>.patch`; exit 0 is `pass`.

Failed gate (one retry per pipeline run):
1. Route fixes under Owner edits. For no-barrier failures, cite the command, exit code, and saved output path (or the slice result's `agent://<id>` for a slice acceptance command). The coordinator fixes wave-0 contract or spec-test failures.
2. After owner fixes and required slice re-gates, retry the failed gate once with a `-retry` suffix (no-barrier: same command).
3. A second failure, or a failure no single owner can fix, stops the pipeline: `ask` the user with the gate output. No audit.

Audit fixes follow Owner edits, then run `--label integrate-audit --base $BASE --full` (no-barrier: integration command). On `fail`, stop and `ask` the user with its output.

When the user says `parallel`/`parallelize`, MUST use `task` subagents - parallel tool calls alone are insufficient.
