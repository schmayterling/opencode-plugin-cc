---
name: agents
description: List available OpenCode agents.
disable_model_invocation: true
allowed_tools:
  - Bash(node *)
---

# /opencode:agents

list all available opencode agents.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/opencode-companion.mjs" agents
```

return the output verbatim.
