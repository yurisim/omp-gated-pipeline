# color-audit — Antigravity runtime mapping

Follow [SKILL.md](./SKILL.md) with these mappings:

| OMP (`SKILL.md`) | Antigravity |
| --- | --- |
| `scout` agents in one `task` batch | `research` subagents via parallel `invoke_subagent` calls |
| `ask` | `ask_question` |
| `local://<topic>-color-audit.md` | file in the artifact directory; reply inline in read-only turns and save later only if requested |
| skill://modern-web-guidance | the `modern-web-guidance` skill if installed; otherwise skip |
