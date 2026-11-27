---
description: Gated plan pipeline (omp-gated-pipeline) - fan-out, deterministic plan preflight, post-implementation adversarial review
alwaysApply: true
trigger: always_on
agents: main
---

- Plans: every plan-mode plan (local://*-plan.md) MUST include a `## Parallel waves` section in the skill://parallel-fanout format. Before proposing it (`xd://propose`), run skill://plan-preflight on it. On `pass`, propose it with no LLM review or self-critique of the plan, unless the user explicitly asks for a plan review.
- Planning research: when a plan spans 3 or more areas (modules, packages, features) whose code this session has not read, spawn one read-only `scout` per area in a single `task` batch before drafting. Below that, read the files directly.
- Execution: before executing an approved plan or a change touching 2+ files, modules, or features, follow skill://parallel-fanout. Even outside plans, give code, scripts, tests, and build config to `synth` as contracts, not code, except for single-file fixes within the size limit below, wave-0 spec tests, or work the user explicitly asks the coordinator to author. No exception overrides "Owner edits" (skill://parallel-fanout section 3) during a pipeline run.
- Review: before reporting done on any change that edits code, scripts, tests, or build config, read skill://adversarial-review and run its one review pass after the repo's tests and checks have run.
- Project specifics: the project's AGENTS.md section `Pipeline - <project> specifics` names the barrier or integration command and the project's pipeline rules. Without that section, use the no-barrier path in skill://parallel-fanout with the project's documented full check command.
- Exempt from fan-out: questions, single-file fixes of about 30 changed lines or fewer, and debugging loops where each step depends on the previous result. Exempt from review: questions and investigations with no edits, docs-only edits, and typo/format-only changes.
- Antigravity runtime: follow each skill's `antigravity.md` (use `swarm` for 2+ implementation slices and adversarial review even outside `/swarm` — those skills explicitly authorize calling `swarm` — with parallel `invoke_subagent` for research scouts, single-slice waves, and fallback); present the plan artifact for approval, requiring parallel waves and preflight for written `/plan` artifacts and multi-file plans, not trivial `exit_plan_mode` handoffs in read-only Plan/Execute turns.
