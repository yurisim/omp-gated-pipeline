# Trim omp-gated-pipeline skills (subtractive)

## Context

The user asked how effective the omp-gated-pipeline skills were on 2026-11-01 and proposed fixing them by cutting. They chose these cuts:
1. Reduce `rules/gated-pipeline.md` to pointers only.
2. Drop the "note BASE sha in a todo" instruction.
3. Delete the critic agent and the rerun/retry ladder. A failed gate goes back once to the owning implementation agent; after that, stop and ask.
4. Slim the spec-conflict handling to "ask the user".
5. Remove preflight's serial-plan `path:line` anchor checks, keeping the slice-JSON checks.
6. Keep the author-family reviewer split, stated once in the skill.
7. Release as 1.2.0: commit, push, relink in omp.

Repo: `C:/Users/yuras/projects/omp-gated-pipeline`. The tree was clean at HEAD `96b2d57` when this plan was written. There is no AGENTS.md, so this is the no-barrier path. Integration command: `python -m unittest discover -s tests -v`.

Evidence behind the cuts, from today's session logs:
- Every plan passed preflight except for:
  - one format nit;
  - one false positive (an untracked plan copy treated as a caller);
  - one stale line range in an already-executed docs plan.
- The critic, `SPEC_CONFLICT`, and the `-rerun`/`-retry` steps only ever ran in smoke tests.
- The BASE todo cost 2 sessions an extra turn each.
- Rule/skill duplication produced a contradiction that a reviewer flagged.
- The anchor feature (commits `0d4d031`, `996c4df`) only added to `preflight.py`, `tests/test_preflight.py`, `skills/plan-preflight/SKILL.md` and README line 6, so `ce2ae3a` holds the exact pre-anchor content of those files.

## Approach

All edits are independent; they run as one wave (see Parallel waves).

1. **Preflight anchors out (code; S1 `synth`).** Overwrite these files with their `ce2ae3a` content:
   - `skills/plan-preflight/preflight.py`
   - `tests/test_preflight.py`

   This removes `check_anchors`, `INLINE_CODE`, `ANCHOR`, `ANCHOR_SYMBOL`, the `anchors` report key, the `serial_plan` test helper and the 10 anchor tests. 15 tests remain. Use read-only `git show`, for example `git show ce2ae3a:skills/plan-preflight/preflight.py > skills/plan-preflight/preflight.py`.
2. **Rule → pointers (S2 `sonic`).** Replace all of `rules/gated-pipeline.md` with **Text: rule** below. Everything it drops already lives in the skills:
   - serial-plan form, docs-only skip, BASE: parallel-fanout §0/§1;
   - reviewer routing, review payload, cooldown: adversarial-review;
   - preflight pass/fail handling: plan-preflight.

   The "step-by-step applies between waves" clause is dropped on purpose.
3. **parallel-fanout (S3 `sonic`).** Apply **Text: parallel-fanout edits** E1–E3 to `skills/parallel-fanout/SKILL.md`:
   - E1 removes the BASE todo;
   - E2 removes the `-retry`/critic mention from the serial-plan bullet;
   - E3 replaces the region from `Spec conflicts (synth's Turn 1 Protocol):` through the line `Audit fixes are re-gated with ... via \`ask\`.` with the new gate block.

   Leave the final `When the user says \`parallel\`...` line and everything before `Spec conflicts` unchanged except E1/E2.
4. **adversarial-review + synth (S4 `sonic`).**
   - In `skills/adversarial-review/SKILL.md` Prepare step 1, delete the sentence ` Note the resolved sha in a todo.` (with its leading space). Reviewer routing (lines 8–11) stays as the only statement of the split.
   - In `agents/synth.md`, replace rule 7 with **Text: synth rule 7**.
5. **Preflight docs, README, critic, version (S5 `sonic`).**
   - Overwrite `skills/plan-preflight/SKILL.md` with `git show ce2ae3a:skills/plan-preflight/SKILL.md`.
   - Delete `agents/critic.md`.
   - Apply **Text: README edits**.
   - Set `"version": "1.2.0"` in `package.json`.
6. **Integrate, review, release (coordinator, after the wave).**
   - Run the integration command and the Verification checks.
   - Run the adversarial-review pass:
     - `adversarial-reviewer` gets S1's files;
     - `adversarial-reviewer-sol` gets the sonic/coordinator files;
     - spawn both in one batch.
   - Commit with the message `refactor(pipeline): trim rule to skill pointers; drop critic, retry ladder, BASE todo and preflight anchors; v1.2.0`, then `git push origin main`.
   - Relink: `omp plugin uninstall omp-gated-pipeline && omp plugin link C:/Users/yuras/projects/omp-gated-pipeline && omp plugin list && omp plugin doctor`.

Project `AGENTS.md` files (desktop-agent, som, ai-101) do not mention the critic, anchors or retry labels, so no project edits are needed. Old `.omp/plans/*` files are historical; leave them as they are.

### Text: rule

Full new content of `rules/gated-pipeline.md`:

````markdown
---
description: Gated plan pipeline (omp-gated-pipeline) - fan-out, deterministic plan preflight, post-implementation adversarial review
alwaysApply: true
agents: main
---

Gated pipeline. The procedures live in the skills; this rule says when to use them.

- Plans: every plan-mode plan (local://*-plan.md) MUST include a `## Parallel waves` section in the skill://parallel-fanout format. Before proposing it (`xd://propose`), run skill://plan-preflight on it. On `pass`, propose it with no LLM review or self-critique of the plan, unless the user explicitly asks for a plan review.
- Execution: before executing an approved plan, or any change touching 2+ files, modules, or features, read skill://parallel-fanout and follow it. Code, scripts, tests, and build config go to `synth` (Sol) slices given contracts, not code, even outside a plan; the exceptions are wave-0 spec tests and single-file fixes of about 30 changed lines or fewer.
- Review: before reporting done on any change that edits code, scripts, tests, or build config, read skill://adversarial-review and run its one review pass after the repo's tests and checks have run. One review pass per user request; fixes for its findings rerun the checks they touch, not the review.
- Project specifics: the project's AGENTS.md section `Pipeline - <project> specifics` names the barrier or integration command and the project's pipeline rules. Without that section, use the no-barrier path in skill://parallel-fanout with the project's documented full check command.
- Exempt from fan-out: questions, single-file fixes of about 30 changed lines or fewer, and debugging loops where each step depends on the previous result. Exempt from review: questions and investigations with no edits, docs-only edits, and typo/format-only changes.
````

### Text: parallel-fanout edits

E1, in the `## 0. Baseline` paragraph: delete ` and note the resolved sha in a todo so it survives compaction`. The sentence then ends `...use \`BASE=$(git rev-parse HEAD)\`).` and is followed by ` It snapshots pre-existing uncommitted work...`.

E2, at the end of the `- Serial plans ("Serial: <reason>")` bullet: replace

`On a failed gate the coordinator fixes it and reruns that gate once with the \`-retry\` suffix; a second failure stops the pipeline and is reported. The critic loop does not apply.`

with

`On a failed gate the coordinator fixes it and reruns that gate once; a second failure stops the pipeline and is reported.`

E3: replace the region from the line `Spec conflicts (synth's Turn 1 Protocol):` through the line starting `Audit fixes are re-gated with` (inclusive; it is currently lines 60–90) with:

````markdown
Spec conflicts: a `synth` that returns a non-empty `specConflict` made no edits. Read each cited `file:line`, then `ask` the user with the `SPEC_CONFLICT` lines and what you found. After the user decides, patch the plan, rerun skill://plan-preflight, and send the corrected slice JSON to the same synth with `write agent://<id>`.

Slice gate, after the whole wave has returned: a slice is accepted when its last barrier verdict (or acceptance command) passed.

Integration gate, after the last wave: `<barrier> --label integrate --base $BASE --full`. `pass` goes to the audit (skill://adversarial-review, section "Barrier-gated changes").

No-barrier projects (the AGENTS.md pipeline section names no barrier command): slice gates are their acceptance commands. The integration gate is the section's integration command: save its output to `local://<topic>-integrate.txt` and `git diff $BASE` to `local://<topic>.patch`; exit 0 is `pass`. The audit uses `local://<topic>.patch` as OUTPUT.

Failed gate (one retry per pipeline run):
1. Send the failure with `write agent://<id>` to the implementation agent that owns the failing code: the failed test ids and the barrier `.json`/`.txt` (no-barrier: the command, exit code, and saved output), plus focused fix instructions inside its `owns`. Forbid new tests and any edit, deletion, skip, or loosening of spec tests. A failure in a wave-0 contract or spec test is the coordinator's to fix.
2. Wait for it to return, then rerun the failed gate once with a `-retry` label suffix (no-barrier: the same command). For a `sonic` owner, first rerun its slice barrier or acceptance command.
3. A second failure, or a failure no single owner can fix, stops the pipeline: `ask` the user with the gate output. No audit.

Audit fixes are re-gated with `--label integrate-audit --base $BASE --full` (no-barrier: the integration command). A `fail` there stops the pipeline: `ask` the user with its output.
````

### Text: synth rule 7

Replace the line starting `7. When the coordinator messages you critic instructions` in `agents/synth.md` with:

`7. When the coordinator messages you a failed gate or review findings, apply exactly the requested fix inside \`owns\`, rerun rule 4 or 5, and yield the same schema again. When it messages a corrected slice spec after a SPEC_CONFLICT, rerun the Turn 1 Protocol on that spec first.`

### Text: README edits

- Line 5 becomes: ``- `rules/gated-pipeline.md`: always-apply main-session rule: when to plan, fan out, and review.``
- Line 6 becomes: ``- `skills/plan-preflight/`: `preflight.py` checks plan paths/symbols (`[NEW]` exempt) and unlisted callers of changed signatures.``
- Line 8 becomes: ``- `agents/synth.md` (Sol; `SPEC_CONFLICT` gate), `agents/adversarial-reviewer.md` (Opus with a Sol advisor) and `agents/adversarial-reviewer-sol.md` (Sol with an Opus advisor), both loading `skills/adversarial-review/reviewer.md`.``

## Critical files & anchors

- `skills/parallel-fanout/SKILL.md:60-90`: the critic/spec-conflict/gate region that E3 replaces; line 92 stays.
- `skills/adversarial-review/SKILL.md:72`: still cites `integrate-retry.patch`. That stays valid because E3 keeps the `-retry` label.
- `agents/synth.md:40`: rule 7.

## Parallel waves

Wave 0: no spec tests and no shared contracts beyond the texts above. There is no barrier: record `no spec tests; no wave0-red.json` in CHECKS. Before spawning, record `BASE=$(git stash create)`, falling back to `git rev-parse HEAD` if empty.

Wave 1 (one `task` batch; context carries BASE and states the no-barrier path. Sonic tasks get the matching `### Text:` section of this plan verbatim):

```json
[
  {"id": "S1", "agent": "synth", "owns": ["skills/plan-preflight/preflight.py", "tests/test_preflight.py"], "reads": [], "symbols": [], "invariants": ["Both files are byte-for-byte the output of `git show ce2ae3a:<path>`", "preflight report JSON has keys verdict, root, slices, diagnostics, elapsed_ms and no anchors key", "Only read-only git commands (git show) are used"], "tests": [], "acceptance": "python -m unittest discover -s tests -v exits 0 with 'Ran 15 tests', and git diff --exit-code ce2ae3a -- skills/plan-preflight/preflight.py tests/test_preflight.py exits 0"},
  {"id": "S2", "agent": "sonic", "owns": ["rules/gated-pipeline.md"], "reads": [], "symbols": [], "invariants": ["File content equals plan section 'Text: rule' exactly (inside the outer fence)"], "tests": [], "acceptance": "test $(wc -c < rules/gated-pipeline.md) -lt 2600 && ! git grep -q -i -w -e critic -e todo -- rules"},
  {"id": "S3", "agent": "sonic", "owns": ["skills/parallel-fanout/SKILL.md"], "reads": [], "symbols": [], "invariants": ["Only edits E1, E2, E3 from plan section 'Text: parallel-fanout edits'", "The final line about parallel/parallelize is unchanged"], "tests": [], "acceptance": "! git grep -q -i -w -e critic -e todo -e '<id>-rerun' -- skills/parallel-fanout && git grep -q 'Failed gate (one retry per pipeline run):' -- skills/parallel-fanout"},
  {"id": "S4", "agent": "sonic", "owns": ["skills/adversarial-review/SKILL.md", "agents/synth.md"], "reads": [], "symbols": [], "invariants": ["adversarial-review: only the sentence ' Note the resolved sha in a todo.' is removed", "synth.md: only rule 7 is replaced, with plan section 'Text: synth rule 7'"], "tests": [], "acceptance": "! git grep -q -i -e 'in a todo' -e 'critic instructions' -- skills/adversarial-review/SKILL.md agents/synth.md"},
  {"id": "S5", "agent": "sonic", "owns": ["skills/plan-preflight/SKILL.md", "README.md", "agents/critic.md", "package.json"], "reads": [], "symbols": [], "invariants": ["SKILL.md equals git show ce2ae3a:skills/plan-preflight/SKILL.md", "agents/critic.md is deleted", "README lines 5, 6, 8 match plan section 'Text: README edits'", "package.json version is 1.2.0 and nothing else changes"], "tests": [], "acceptance": "test ! -e agents/critic.md && git diff --quiet ce2ae3a -- skills/plan-preflight/SKILL.md && ! git grep -q -i -w -e critic -e anchors -- README.md && grep -q '\"version\": \"1.2.0\"' package.json"}
]
```

## Verification

Run from `C:/Users/yuras/projects/omp-gated-pipeline` unless noted.

1. Integration: `python -m unittest discover -s tests -v > local://skills-trim-integrate.txt 2>&1`. Expect exit 0 and `Ran 15 tests ... OK`. Save `git diff $BASE > local://skills-trim.patch`.
2. New behavior: a serial plan that cites a missing file is no longer rejected.

   ```
   printf '# P\n\n## C\n\nSee `src/gone.py:4`.\n\n## Parallel waves\n\nSerial: x\nAcceptance: y\n' | python skills/plan-preflight/preflight.py -
   ```

   Expect exit 0, `"verdict": "pass"`, `"slices": 0` and no `anchors` key. Under 1.1.1 this case failed with `PATH_MISSING`.
3. Slice checks still bite: `printf '# P\n\n## Parallel waves\n\n```json\n[{"id":"X","agent":"synth","owns":["src/nope.py"],"reads":[],"symbols":[],"invariants":[],"tests":[],"acceptance":"x"}]\n```\n' | python skills/plan-preflight/preflight.py -`. Expect exit 1 with one `PATH_MISSING` for `src/nope.py`.
4. Real plan from today, run in `C:/Users/yuras/projects/desktop-agent`: `python C:/Users/yuras/projects/omp-gated-pipeline/skills/plan-preflight/preflight.py .omp/plans/ARCHITECTURE_DIAGRAMS_PLAN.md`. Expect `pass`, `slices: 0`; under 1.1.1 it was `LINE_OUT_OF_RANGE` on `controller/run.py:79-132`. If it reports `BAD_SPEC` because that copy lacks the Serial/Acceptance lines, record that and rely on check 2.
5. No stale references: `git grep -n -i -w -e critic -e anchors -e 'resolved sha in a todo' -- rules skills agents README.md`. Expect no output (exit 1). `CRITICAL` does not match `-w critic`.
6. Size: `wc -c rules/gated-pipeline.md skills/parallel-fanout/SKILL.md skills/plan-preflight/SKILL.md skills/plan-preflight/preflight.py`. Expect the rule under 2600 bytes (was 5677), plan-preflight SKILL 2200 (was 4010) and `preflight.py` 13145 (was 19778).
7. After the relink, `omp plugin list` shows `omp-gated-pipeline@1.2.0` and `omp plugin doctor` reports 0 errors. Then `omp read skill://parallel-fanout` (or `read skill://parallel-fanout` in a new session) contains `Failed gate (one retry per pipeline run):` and not `Critic loop`.

## Assumptions & contingencies

- If `git push origin main` fails (auth or non-fast-forward), keep the local commit, skip the relink, and report the exact error to the user. Never force-push.
- If `omp plugin uninstall` fails because the plugin is not installed, run only `omp plugin link C:/Users/yuras/projects/omp-gated-pipeline`.
