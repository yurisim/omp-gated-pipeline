---
description: Gated plan pipeline (omp-gated-pipeline) - fan-out, deterministic plan preflight, post-implementation adversarial review
alwaysApply: true
agents: main
---

Gated pipeline. The procedures live in the skills; this rule says when to use them.

- Plans: every plan-mode plan (local://*-plan.md) MUST include a `## Parallel waves` section in the skill://parallel-fanout format. Before proposing it (`xd://propose`), run skill://plan-preflight on it. On `pass`, propose it with no LLM review or self-critique of the plan, unless the user explicitly asks for a plan review.
- Execution: before executing an approved plan, or any change touching 2+ files, modules, or features, read skill://parallel-fanout and follow it. Code, scripts, tests, and build config go to `synth` (Sol) slices given contracts, not code, even outside a plan; the exceptions are wave-0 spec tests, single-file fixes of about 30 changed lines or fewer, and work the user explicitly asks Claude to author (skill://parallel-fanout section 2). During a pipeline run, a change to a file a `synth` slice owns goes to that synth (skill://parallel-fanout section 3, "Owner edits"), never an inline coordinator edit, even when an exemption below applies.
- Review: before reporting done on any change that edits code, scripts, tests, or build config, read skill://adversarial-review and run its one review pass after the repo's tests and checks have run. One review pass per user request; fixes for its findings rerun the checks they touch, not the review.
- Project specifics: the project's AGENTS.md section `Pipeline - <project> specifics` names the barrier or integration command and the project's pipeline rules. Without that section, use the no-barrier path in skill://parallel-fanout with the project's documented full check command.
- Exempt from fan-out: questions, single-file fixes of about 30 changed lines or fewer, and debugging loops where each step depends on the previous result. Exempt from review: questions and investigations with no edits, docs-only edits, and typo/format-only changes.
