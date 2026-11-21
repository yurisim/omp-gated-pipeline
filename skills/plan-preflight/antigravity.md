# plan-preflight — Antigravity runtime mapping

Use [SKILL.md](./SKILL.md) for all checks, tagging rules, and verdict handling. Apply only these runtime mappings in Antigravity:

## Running `preflight.py`

`preflight.py` sits next to this file (Antigravity provides the full path to `SKILL.md` in `<skills>`). Pass the plan file path directly as a positional argument so the command works identically in PowerShell, cmd, bash, and zsh (PowerShell does not support `<` stdin redirection):

```powershell
python "<skill-dir>/preflight.py" "<plan-file.md>"
```

`-` (stdin) and `--root <dir>` work as documented in `SKILL.md`.

## Read-only Plan/Execute turns

Plan/Execute turns block `write_file`, so a plan may exist only inline. Pipe it to `preflight.py -` on stdin (`@'<plan text>'@ | python "<skill-dir>/preflight.py" -`), or run `preflight.py` at the start of the execution turn before Wave 1.

The plugin's root `hooks.json` also runs `preflight.py` automatically before `write_file` saves `implementation_plan.md` or `*-plan.md` containing `## Parallel waves`, and denies the write on `fail`.

## Tool & path mapping

| OMP (`SKILL.md`) | Antigravity |
| --- | --- |
| `local://<slug>-plan.md` | Plan artifact path (e.g. `<artifact-dir>/implementation_plan.md`) |
| `ask` | `ask_question` |
