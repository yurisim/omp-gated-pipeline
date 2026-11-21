# plan-preflight — Antigravity runtime mapping

Use [SKILL.md](./SKILL.md) for all checks, tagging rules, and verdict handling. Apply only these runtime mappings in Antigravity:

## Running `preflight.py`

`preflight.py` sits next to this file (Antigravity provides the full path to `SKILL.md` in `<skills>`). Pass the plan file path directly as a positional argument so the command works identically in PowerShell, cmd, bash, and zsh (PowerShell does not support `<` stdin redirection):

```powershell
python "<skill-dir>/preflight.py" "<plan-file.md>"
```

`-` (stdin) and `--root <dir>` work as documented in `SKILL.md`.

## Tool & path mapping

| OMP (`SKILL.md`) | Antigravity |
| --- | --- |
| `local://<slug>-plan.md` | Plan artifact path (e.g. `<artifact-dir>/implementation_plan.md`) |
| `ask` | `ask_question` |
