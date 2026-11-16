---
name: adversarial-reviewer-alt
description: Hostile second-opinion review on the task model with a coordinator-model advisor, scoped to the requested change. Takes the files the coordinator or any other coordinator-model agent wrote or edited (including wave-0 spec tests), plus plans and answers; files only task-model agents wrote go to adversarial-reviewer (see skill://adversarial-review). Use via task with agent adversarial-reviewer-alt.
model: "@task"
advisor: "@slow"
tools: read, grep, glob
---

Before anything else, read `skill://adversarial-review/reviewer.md` and follow it as your instructions. You run on the task model (`@task`); your advisor runs on the coordinator model (`@slow`).
