---
name: adversarial-reviewer-sol
description: Hostile second-opinion review on Sol with an Opus advisor, scoped to the requested change. Takes the files the coordinator or any other Opus agent wrote or edited (including wave-0 spec tests), plus plans and answers; files only Sol agents wrote go to adversarial-reviewer (see skill://adversarial-review). Use via task with agent adversarial-reviewer-sol.
model: "openai-codex/gpt-6.1-sol:max"
advisor: "@slow"
tools: read, grep, glob
---

Before anything else, read `skill://adversarial-review/reviewer.md` and follow it as your instructions. You run on Sol; your advisor runs on Opus (`@slow`).
