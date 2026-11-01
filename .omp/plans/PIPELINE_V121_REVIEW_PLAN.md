# omp-gated-pipeline: post-1.2.1 effectiveness review and fixes

## Context

The user asked how well omp-gated-pipeline 1.2.1 parallelizes and improves work. 1.2.1 makes advisor reviews synchronous and final-only (`advisor.reviewMode: agent-end`, `advisor.syncBacklog: strict`) and limits `skill://adversarial-review` to the coordinator. They also reported that parallel waves "never seem marked complete until the end" on the TODO list. The evidence is the three desktop-agent sessions run after the release on 2026-11-01, under `~/.omp/agent/sessions/-projects-desktop-agent/`:
- `01a198f6` plans the JTR knowledge package.
- `01a1992d` executes it, then plans hybrid embeddings.
- `01a19955` executes hybrid embeddings.

End state: wave progress is visible as it happens, reviewer reports survive advisor revisions, subagents stop loading coordinator and graph skills, and preflight stops flagging autosaved plan copies.

## Findings

- **Waves run, but parallelism is limited by dependency chains.** In 01a1992d S1 ran first (22:15:34→22:17:21), then S2 and S3 ran in parallel (22:17:50→22:18:57). In 01a19955 S1 ran (22:58:44→22:59:39), then S2 (23:00:01→23:01:58), so each wave had one slice. Both chains were real dependencies: S2/S3 import S1's `knowledge` module, and S2 needs `embed.encode` to rebuild the vectors. The two reviewers and the two planning scouts each ran as parallel pairs.
- **TODO wave items closed late (the user's report).**
  - 01a1992d marked each slice done right after collecting it.
  - 01a19955 named its items after actions (`Preflight + spawn S1`, `Spawn S2`) under one `Waves` phase, and closed them at 23:08:03. That was after its final answer, and only because a `You stopped with 3 incomplete todo item(s)` reminder fired. In the same run it marked `Docs update` done at 22:59:39, before S2 had even spawned.
  - `skills/parallel-fanout/SKILL.md` gives no guidance on the todo list, so each coordinator invents its own layout.
- **Synchronous reviewer advisors work.**
  - In all 4 reviews the result reached the coordinator after the advisor had finished. For example, ReviewSolWritten's advisor ended at 22:25:23.411 and the result was delivered at 22:25:23.435.
  - One `concern` (01a1992d ReviewOpusWritten: test lines 43–150 were never read) and one `blocker` (01a19955 ReviewOpusFiles: a fidelity claim with no evidence) each triggered one revision pass, costing 22 s and 10 s.
- **A revision can hide the original findings.** After its advisor's blocker, ReviewOpusFiles' last message was a 4-line delta ("the previously reported guide result-count warning remains unchanged"), and the coordinator receives only the last message. The coordinator recovered the WARN (`docs/USER_GUIDE.md:194`) by reading the reviewer's history, then fixed it. `skills/adversarial-review/reviewer.md:102` does not say that the revised report must be complete.
- **The reviews keep catching real defects that no gate caught.** Each defect below was reproduced by a test, fixed, and re-gated (1726 and then 1733 tests passed):
  - 01a1992d: `zlib.error` from a damaged user package crashes every run and keeps Settings from opening.
  - 01a19955: `vectors.npy` saved as a zip crashes `load_packages()`.
  - Several documentation inaccuracies.
- **Plans still bring defects in, and no longer get any second-model review.**
  - The `vectors.npy` crash was written into the plan: `local://jtr-hybrid-embeddings-plan.md:80-81` specifies `np.load(f, allow_pickle=False)` with `(OSError, EOFError, ValueError)`.
  - When `xd://propose` ends a plan-mode turn, the turn stops as `aborted`, and an `agent-end` advisor does not review an aborted end. Planning session 01a198f6 (3 proposes) has no `__advisor.jsonl` at all, and the main advisor in 01a1992d reviewed only the 22:27 execution answer, not the two later proposes.
  - Before 1.2.1, the per-turn advisor was the only check on plans (it flagged AI570 Q55 1 s after the propose).
  - `rules/gated-pipeline.md:9` forbids any LLM review of a plan unless the user asks.
- **Subagents still load skills they don't need.** Since 1.2.1 no subagent has read `skill://adversarial-review` (16 of 16 had before). But:
  - `skill://plan-preflight` (2.2 KB) was read by 4 of 11 subagents: synths S1KnowledgeRuntime and S2AgentKnowledge, and scouts SkillsPrompt and StoreLLMUI.
  - `skill://parallel-fanout` (9.9 KB) was read by 1 (SkillsPrompt).
  - `skill://graphify` (47 KB, at `~/.agents/skills/graphify`, outside this package) was read by 7 (3 synths, 2 reviewers, 2 scouts), even though neither desktop-agent nor som has a `graphify-out/`.
- **Preflight flags autosaved plan copies as callers.**
  - At execution, preflight failed: `UNLISTED_CALLER … .omp/plans/JTR_KNOWLEDGE_PACKAGE_PLAN.md references main_role`.
  - That file is the plan-mode autosave copy (`plan.autosave: true`).
  - The coordinator worked around it by adding the copy to S2's `reads`, and S2 then read it.
  - `references()` in `skills/plan-preflight/preflight.py:193-218` searches every untracked file and has no exclusion for `.omp/plans/`.
- **Cost.**

  |Session|Opus coordinator|Sol slices|Reviews (both reviewers + their advisors)|Main advisor|
  |---|---|---|---|---|
  |01a198f6 plan|8.22|0.52 (scouts)|—|0|
  |01a1992d exec (to 22:28)|3.58|0.64|2.27|0.14|
  |01a19955 exec|2.40|0.29|1.66|0.12|

  - In the AI570 run the main advisor alone cost $15.28; across these 3 sessions it cost $0.26.
  - The two executions took 14 and 10 minutes from approval to final answer. Waiting on reviews took about 3.5 and 3 minutes of that; the synchronous advisor added 9–22 s per reviewer.

## Approach

The steps are independent, but do them in this order.

### 1. Wave progress on the TODO list (`skills/parallel-fanout/SKILL.md`)

Insert this paragraph after line 58 (`Keep working while siblings run. …`), with a blank line before and after it:

```markdown
Progress: mirror the plan's waves in `todo`. Use phases `Wave 0`, `Wave 1` … `Wave N` (one per wave in `## Parallel waves`), then `Integration`. Each slice gets one item named by outcome, `<id>: <what it delivers>` (for example `S2: agent integration`), never by action (`Spawn S2`). Wave 0 items are the contract and spec-test writes and `wave0-red`. Mark a slice item `done` once its result is collected and its slice gate passes, in the same response as your next tool call. Close every item of a wave before spawning the next wave; never batch-close items at the end of the run.
```

### 2. Reviewer reports survive advisor revisions (`skills/adversarial-review/reviewer.md`)

Replace line 102 (`- Advisor notes: fold accepted ones …`) with:

```markdown
- Advisor notes: fold accepted ones into findings. A note that refutes a finding with a cited line wins unless you can cite a line refuting the note. Drop other rejected notes silently unless BLOCK-level; then add one line. Your caller receives only your last message: after any advisor note, re-emit the complete report (every finding, the verdict, Summary, and Handoff), never a delta that points to an earlier message.
```

### 3. Subagents stop loading coordinator and graph skills

- `skills/plan-preflight/SKILL.md` line 3 becomes:
  `description: Main-session coordinator only; subagents never load this skill. Zero-token deterministic gate for plan files - path/symbol existence and unlisted callers of changed signatures. Run before proposing any plan and before spawning wave 1.`
- `skills/parallel-fanout/SKILL.md` line 3 becomes:
  `description: "Main-session coordinator only; subagents never load this skill. Auto-fan independent work into one parallel task batch without being asked."`
- `agents/synth.md`: append after line 40 (rule 7):
  `8. Read only skills that your task text or the project's AGENTS.md names for your owned files. Never read skill://plan-preflight, skill://parallel-fanout, skill://adversarial-review, or skill://graphify: the coordinator owns planning, fan-out, and review, and your \`owns\`/\`reads\` replace codebase exploration.`
- `skills/adversarial-review/reviewer.md`: insert after line 101 (`- Do not spawn subagents. …`):
  `- Skills: read only this file and skills the project's AGENTS.md names for the files under review. Never read skill://graphify, skill://plan-preflight, skill://parallel-fanout, or skill://adversarial-review/SKILL.md.`
- Leave `~/.agents/skills/graphify/SKILL.md` alone. It is a third-party skill outside this package, and an update would overwrite any edit. Built-in `scout`/`task` agents will keep reading it.

### 4. Preflight ignores autosaved plan copies (code: wave 0 test, then synth slice S1)

- Wave 0 (coordinator): insert this test into `tests/test_preflight.py` directly after `test_signature_change_flags_unlisted_caller_until_listed` (ends line 100), with one blank line before it:

  ```python
      def test_autosaved_plan_copies_are_not_callers(self):
          self.write(".omp/plans/OLD_PLAN.md", "Change `add` to take strings.\n")
          changed = {"path": "src/a.ts", "name": "add", "signature": "add(a: string): string", "contract": "c"}
          for use_git in (False, True):
              with self.subTest(git=use_git):
                  if use_git:
                      subprocess.run(["git", "init", "-q", str(self.root)], check=True)
                  code, report = self.run_preflight(plan_text([slice_spec(owns=["src/a.ts"], symbols=[changed])]))
                  self.assertEqual((code, report["verdict"], report["diagnostics"]), (0, "pass", []))
  ```

  Then run `python -m unittest tests.test_preflight.PreflightTest.test_autosaved_plan_copies_are_not_callers` from the repo root. It must FAIL with `UNLISTED_CALLER`; if it passes, stop and report, because the premise is wrong.
- Wave 1: spawn slice S1 (JSON in Parallel waves) as `synth`.

## Critical files & anchors

- `skills/parallel-fanout/SKILL.md:3,58`: description; the start of the "Collect and gate" section.
- `skills/adversarial-review/reviewer.md:101-102`: the Rules on subagents and on advisor notes.
- `skills/plan-preflight/preflight.py:193-218` `references()`: the `git grep --untracked` path and the `os.walk` fallback (`PRUNED_DIRS` at line 19 holds only directory names, so it can't express `.omp/plans`).
- `agents/synth.md:29-40`: Rules 1–7.

## Parallel waves

Wave 0: the coordinator writes the spec test from Approach step 4 verbatim and confirms it fails. Approach steps 1–3 are instruction-only edits that the coordinator makes inline.

Wave 1:

```json
[
  {
    "id": "S1",
    "agent": "synth",
    "owns": ["skills/plan-preflight/preflight.py"],
    "reads": ["tests/test_preflight.py", "skills/plan-preflight/SKILL.md"],
    "symbols": [
      {
        "path": "skills/plan-preflight/preflight.py",
        "name": "references",
        "signature": "def references(root: Path, ident: str) -> set[str]:",
        "contract": "never returns a path under .omp/plans/ (autosaved plan copies), from both the git grep branch and the os.walk fallback; every other result unchanged"
      }
    ],
    "invariants": [
      "references() signature and the UNLISTED_CALLER diagnostic text are unchanged",
      "a real caller outside .omp/plans/ is still reported"
    ],
    "tests": [],
    "acceptance": "python -m unittest discover -s tests -v"
  }
]
```

Integration (no AGENTS.md, so the no-barrier path): `python -m unittest discover -s tests -v`, run from `C:/Users/yuras/projects/omp-gated-pipeline`.

## Verification

Run from `C:/Users/yuras/projects/omp-gated-pipeline`.

1. `python -m unittest discover -s tests -v` exits 0, with 16 tests including `test_autosaved_plan_copies_are_not_callers`. It failed in wave 0.
2. **Preflight, real case:** from `C:/Users/yuras/projects/desktop-agent`, run `python C:/Users/yuras/projects/omp-gated-pipeline/skills/plan-preflight/preflight.py C:/Users/yuras/.omp/agent/sessions/-projects-desktop-agent/2026-11-01T21-14-23-372Z_01a198f6-a50c-75eb-b86d-901f75941d23/local/jtr-knowledge-package-plan.md`. Expect no diagnostic that mentions `.omp/plans/`. If `.omp/plans/JTR_KNOWLEDGE_PACKAGE_PLAN.md` no longer exists in desktop-agent, rely on check 1 alone.
3. **Skill loading and TODO progress:** spawn one `synth` smoke with `name: "SmokeSynth"` and the task JSON `{"id":"S1","agent":"synth","owns":["[NEW] local-smoke/hello.py"],"reads":[],"symbols":[{"path":"[NEW] local-smoke/hello.py","name":"[NEW] hello","signature":"def hello() -> str:","contract":"returns 'hi'"}],"invariants":[],"tests":[],"acceptance":"python -c \"import importlib.util,sys;s=importlib.util.spec_from_file_location('h','local-smoke/hello.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);sys.exit(m.hello()!='hi')\""}`, with context `BASE: none. No barrier; run the acceptance command.` Run it in cwd `C:/Users/yuras/projects/omp-gated-pipeline`.
   - After `wait`, find the current session with `archive.sessions(project="~/projects/omp-gated-pipeline", limit=1, silent=True)` and scan `<session dir>/SmokeSynth.jsonl` for tool-call arguments containing `skill://`. Expect none.
   - Delete `local-smoke/` afterwards.
4. The steps 1–3 edits can't be smoke-tested without a live multi-wave run. Confirm them with `grep -n "^Progress: mirror" skills/parallel-fanout/SKILL.md`, `grep -n "re-emit the complete report" skills/adversarial-review/reviewer.md`, and `grep -c "Main-session coordinator only" skills/*/SKILL.md` (expect 3 files).
5. `git status --short` lists only the edited files: `agents/synth.md`, the three `SKILL.md`/`reviewer.md` files, `preflight.py`, and `tests/test_preflight.py`.

## Assumptions & contingencies

- Nothing is committed, pushed, or relinked. The package is symlinked, so the edits take effect immediately.
- If the smoke synth in Verification 3 still reads `skill://graphify`, accept that as residual and report it, since the global skill's description matches every agent. Do not edit `~/.agents/skills/graphify`.
- Plans keep no automatic LLM review: `rules/gated-pipeline.md:9` and `skills/adversarial-review/SKILL.md` lines 3, 15 and 52 stay unchanged. The user ruled the plan-review gap acceptable.
