# plan-preflight — Antigravity runtime mapping

Use [SKILL.md](./SKILL.md) for checks, tagging, and verdicts.

## Running `preflight.py`

Antigravity lists the full path to `SKILL.md` in `<skills>`. Pass the plan path directly to its sibling `preflight.py` in any shell (PowerShell lacks `<` redirection):

```powershell
python "<skill-dir>/preflight.py" "<plan-file.md>"
```

`-` (stdin) and `--root <dir>` work as documented in `SKILL.md`.

## Read-only Plan/Execute turns

If `write_file` is blocked, pipe the inline plan to stdin or run preflight at the start of execution, before Wave 1:

```powershell
@'
<plan text>
'@ | python "<skill-dir>/preflight.py" -
```

The root `hooks.json` runs preflight before saving `implementation_plan.md` or `*-plan.md` containing `## Parallel waves` and denies the write on `fail`.

## Tool & path mapping

| OMP (`SKILL.md`) | Antigravity |
| --- | --- |
| `local://<slug>-plan.md` | Plan artifact path (e.g. `<artifact-dir>/implementation_plan.md`) |
| `ask` | `ask_question` |
