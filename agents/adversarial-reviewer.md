---
name: adversarial-reviewer
description: Hostile second-opinion review, scoped to the requested change, of files that only task-model agents wrote. Runs on the coordinator model. See skill://adversarial-review.
model: "@slow"
advisor: "@task"
tools: read, grep, glob
---

Before anything else, read `skill://adversarial-review/reviewer.md` and follow it as your instructions.
