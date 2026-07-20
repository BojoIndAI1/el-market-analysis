#!/usr/bin/env python3
"""
PreToolUse hook, fires before every Bash tool call in every project on this machine
(registered globally, same config-scoping reasoning as this project's other hooks --
see ~/.claude/CLAUDE.md -- self-scopes by checking the command text, not cwd).

Detects a `vercel` CLI invocation and prints a reminder, before it runs, to confirm the
deploy path first. Why this matters, concretely (root CLAUDE.md, "el-market-analysis.online
deploys via git push, NOT the vercel CLI" section): `npx vercel whoami` on this machine
authenticates as an unrelated personal account that does NOT own el-market-analysis.online --
running `vercel link` + `vercel --prod` from Market_Analysis_Pricing/dashboard/ silently linked
to and deployed a same-named-but-wrong project under that account, a wasted, confusing, failed
build that looked at first glance like the real deployment. The CLI being authenticated and
erroring is NOT the same as being authenticated as the account that owns the resource in
question -- that's a silent failure mode, not a loud one.

This is a PreToolUse hook (not PostToolUse like this project's other hooks) deliberately --
the goal is to interrupt attention BEFORE a wrong link/deploy happens, not just remind
afterward that it might have gone wrong. It does not block -- `vercel` has legitimate uses
(this is a reminder to verify first, not a prohibition), and a hook that blocks ordinary Bash
calls on a loose keyword match would be worse than no hook at all.

Fails silent on anything unexpected. Logs every MATCH to hook_invocations.log in this
directory.
"""
import datetime
import json
import os
import re
import sys

LOG_PATH = os.path.join(os.path.dirname(__file__), "hook_invocations.log")
VERCEL_RE = re.compile(r"\bvercel\b")


def log(line):
    try:
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(f"{datetime.datetime.now().isoformat(timespec='seconds')}  {line}\n")
    except Exception:
        pass


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return

    if payload.get("tool_name") != "Bash":
        return

    command = (payload.get("tool_input", {}) or {}).get("command", "")
    if not command or not VERCEL_RE.search(command):
        return

    log(f"MATCHED: vercel command about to run -- command: {command!r}")
    print(
        "\n[vercel-guard] about to run a `vercel` command. Per root CLAUDE.md's documented "
        "incident: an authenticated, non-erroring `vercel` CLI does NOT mean it's logged into "
        "the account that owns the resource you're targeting. Before proceeding, confirm: (1) "
        "`git remote -v` in the target directory -- if a remote is already configured, deploy "
        "is just `git push`, no `vercel` CLI needed at all; (2) if you do need the CLI, `vercel "
        "whoami` and `vercel domains ls` actually show the real account/domain you expect, not "
        "just that some account is logged in."
    )


if __name__ == "__main__":
    main()
