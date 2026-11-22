---
description: Gated plan pipeline (omp-gated-pipeline) - fan-out, deterministic plan preflight, post-implementation adversarial review
alwaysApply: true
trigger: always_on
agents: main
---

- Plans: every plan-mode plan (local://*-plan.md) MUST include a `## Parallel waves` section in the skill://parallel-fanout format. Before proposing it (`xd://propose`), run skill://plan-preflight on it. On `pass`, propose it with no LLM review or self-critique of the plan, unless the user explicitly asks for a plan review.
- Planning research: when a plan spans 3 or more areas (modules, packages, features) whose code this session has not read, spawn one read-only `scout` per area in a single `task` batch before drafting. Below that, read the files directly.
- Execution: before executing an approved plan, or any change touching 2+ files, modules, or features, read skill://parallel-fanout and follow it. Code, scripts, tests, and build config go to `synth` slices given contracts, not code, even outside a plan; the exceptions are wave-0 spec tests, single-file fixes of about 30 changed lines or fewer, and work the user explicitly asks the coordinator to author. During a pipeline run no exception or exemption overrides "Owner edits" (skill://parallel-fanout section 3).
- Review: before reporting done on any change that edits code, scripts, tests, or build config, read skill://adversarial-review and run its one review pass after the repo's tests and checks have run.
- Project specifics: the project's AGENTS.md section `Pipeline - <project> specifics` names the barrier or integration command and the project's pipeline rules. Without that section, use the no-barrier path in skill://parallel-fanout with the project's documented full check command.
- Exempt from fan-out: questions, single-file fixes of about 30 changed lines or fewer, and debugging loops where each step depends on the previous result. Exempt from review: questions and investigations with no edits, docs-only edits, and typo/format-only changes.
- Antigravity runtime: skill://<name> is the matching skill (also read its antigravity.md), local://*-plan.md is the plan artifact, xd://propose is presenting the plan for approval, scout is the `research` subagent (parallel `invoke_subagent` calls), and implementation waves and cross-family adversarial reviews prefer `swarm` workers (with `invoke_subagent` as fallback — see each skill's `antigravity.md`). Plan/Execute turns are read-only: the `## Parallel waves` + plan-preflight requirement applies to written `/plan` artifacts and multi-file plans, not to trivial single-step `exit_plan_mode` handoffs.
