"""Antigravity PreToolUse hook: run plan-preflight before a plan file with `## Parallel waves` is written.

Reads the hook payload (JSON) on stdin, prints a decision JSON on stdout. Fails open on any error.
"""

import importlib.util
import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote

PREFLIGHT = Path(__file__).resolve().parents[1] / "skills" / "plan-preflight" / "preflight.py"
WAVES_RE = re.compile(r"(?im)^#{2,3}\s+parallel waves\b")
MAX_SHOWN = 10


def emit(decision: str, reason: str | None = None) -> int:
    out = {"decision": decision}
    if reason:
        out["reason"] = reason
    print(json.dumps(out))
    return 0


def uri_to_path(value: str) -> Path:
    if value.startswith("file://"):
        value = unquote(value[len("file://"):])
        if re.match(r"^/[A-Za-z]:", value):
            value = value[1:]
    return Path(value)


def find_root(payload: dict) -> Path | None:
    candidates = [payload.get("cwd")]
    candidates.extend(payload.get("workspacePaths") or [])
    for candidate in candidates:
        if isinstance(candidate, str) and candidate:
            path = uri_to_path(candidate)
            if path.is_dir():
                return path
    return None


def load_preflight():
    spec = importlib.util.spec_from_file_location("preflight", PREFLIGHT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def is_plan_write(payload: dict) -> str | None:
    call = payload.get("toolCall") or {}
    args = call.get("args") or {}
    if call.get("name") != "write_file" or args.get("Append"):
        return None
    name = Path(str(args.get("Path") or args.get("path") or "")).name.lower()
    if name != "implementation_plan.md" and not name.endswith("-plan.md"):
        return None
    content = args.get("Content") or args.get("content") or ""
    return content if isinstance(content, str) and WAVES_RE.search(content) else None


def main() -> int:
    try:
        payload = json.loads(sys.stdin.read())
        content = is_plan_write(payload)
        if content is None:
            return emit("allow")
        root = find_root(payload)
        if root is None:
            return emit("allow")
        pf = load_preflight()
        extracted, diagnostics = pf.extract_slices(content)
        slices, validation = pf.validate_slices(extracted)
        diagnostics.extend(validation)
        diagnostics.extend(pf.check_slices(slices, root))
        if not diagnostics:
            return emit("allow")
        lines = [
            f"- {d['code']} (line {d['line']}, slice {d['slice']}): {d['detail']}"
            for d in diagnostics[:MAX_SHOWN]
        ]
        if len(diagnostics) > MAX_SHOWN:
            lines.append(f"... and {len(diagnostics) - MAX_SHOWN} more")
        return emit("deny", "plan-preflight failed; fix these diagnostics in the plan:\n" + "\n".join(lines))
    except Exception:
        return emit("allow")


if __name__ == "__main__":
    raise SystemExit(main())
