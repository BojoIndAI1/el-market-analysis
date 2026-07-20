#!/usr/bin/env python3
"""
PostToolUse hook, fires after every Edit/Write tool call in every project on this machine
(registered globally per this machine's own config-scoping rule -- self-scopes by checking
the edited path, same pattern as this project's other hooks).

Runs this dashboard's own locally-installed ESLint (`node_modules/.bin/eslint`, ESLint 9 +
eslint-config-next's flat config, `eslint.config.mjs`) against a single edited file whenever
that file is a .ts/.tsx/.js/.jsx source file under Market_Analysis_Pricing/dashboard/ (not
node_modules or the .next build output). Runs `eslint <file>` directly from the local
node_modules/.bin, not `npx`, since it's already installed -- faster and doesn't depend on
network/npm registry access.

Report-only, matching this project's other hooks -- does NOT auto-fix (`--fix`), since
silently rewriting code on every edit is a different, more surprising thing than reminding
about lint issues the way on_doc_edit.py reminds about doc-sync or on_populate_direct_run.py
reminds about sync_db.py. Prints a short status line every time it matches (clean or not),
not just on failure -- same "always visible when it truly fires, silent otherwise" pattern
as this project's other hooks.

Fails silent on anything unexpected (malformed stdin, unknown tool, eslint not installed,
path not tracked) -- a hook that blocks or noisily errors on ordinary edits would be worse
than no hook at all.

Logs every MATCH (not every invocation) to hook_invocations.log in this same directory.
"""
import datetime
import json
import os
import subprocess
import sys

DASHBOARD_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
LOG_PATH = os.path.join(os.path.dirname(__file__), "hook_invocations.log")
LINTABLE_EXT = {".ts", ".tsx", ".js", ".jsx"}
EXCLUDED_DIRS = {"node_modules", ".next"}

ESLINT_BIN = os.path.join(
    DASHBOARD_ROOT, "node_modules", ".bin",
    "eslint.cmd" if os.name == "nt" else "eslint",
)


def log(line):
    try:
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(f"{datetime.datetime.now().isoformat(timespec='seconds')}  {line}\n")
    except Exception:
        pass  # logging must never be the reason this hook breaks an edit


def extract_path(payload):
    tool_input = payload.get("tool_input", {}) or {}
    for key in ("file_path", "path", "notebook_path"):
        if key in tool_input:
            return tool_input[key]
    return None


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return

    if payload.get("tool_name") not in ("Edit", "Write"):
        return

    edited_path = extract_path(payload)
    if not edited_path:
        return

    try:
        edited_abs = os.path.abspath(edited_path)
    except Exception:
        return

    if not edited_abs.startswith(DASHBOARD_ROOT + os.sep):
        return
    if os.path.splitext(edited_abs)[1].lower() not in LINTABLE_EXT:
        return
    rel = os.path.relpath(edited_abs, DASHBOARD_ROOT)
    if any(part in EXCLUDED_DIRS for part in rel.split(os.sep)):
        return
    if not os.path.isfile(ESLINT_BIN):
        return

    log(f"MATCHED: linting {rel}")

    try:
        result = subprocess.run(
            [ESLINT_BIN, rel],
            cwd=DASHBOARD_ROOT,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except Exception as e:
        log(f"ESLINT RUN FAILED: {e}")
        return

    output = (result.stdout + result.stderr).strip()
    if result.returncode == 0 and not output:
        print(f"\n[dashboard-lint] {rel} -- no ESLint issues.")
    else:
        print(f"\n[dashboard-lint] {rel} -- ESLint found issues:\n{output}")


if __name__ == "__main__":
    main()
