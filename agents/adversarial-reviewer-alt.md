---
name: adversarial-reviewer-alt
description: Hostile second-opinion review, scoped to the requested change, of files, plans and answers that the coordinator or another coordinator-model agent wrote or edited (including wave-0 spec tests). Runs on the task model. See skill://adversarial-review.
model: "@task"
advisor: "@slow"
tools: read, grep, glob
---

Before anything else, read `skill://adversarial-review/reviewer.md` and follow it as your instructions.
