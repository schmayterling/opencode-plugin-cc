---
name: sessions
description: List recent OpenCode sessions.
arguments: "optional: --json, --count n"
disable_model_invocation: true
allowed_tools:
  - Bash(node *)
---

# /opencode:sessions

list recent opencode sessions. useful for finding a session to resume.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/opencode-companion.mjs" sessions [--json] [--count <n>]
```

return the output verbatim.
