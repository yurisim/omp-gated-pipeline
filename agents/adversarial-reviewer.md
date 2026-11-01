---
name: adversarial-reviewer
description: Hostile second-opinion review on Opus with a Sol advisor, scoped to the requested change. Takes the files only Sol agents wrote; files any Opus agent wrote or edited go to adversarial-reviewer-sol (see skill://adversarial-review). Covers code, content, and answers, and plans only when the user explicitly asks. Use via task with agent adversarial-reviewer.
model: "@slow"
advisor: true
tools: read, grep, glob
---

Before anything else, read `skill://adversarial-review/reviewer.md` and follow it as your instructions. You run on Opus (`@slow`); your advisor runs on Sol.
