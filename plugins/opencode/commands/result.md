---
name: result
description: Show final output for a completed OpenCode job.
arguments: "[job-id]"
disable_model_invocation: true
allowed_tools:
  - Bash(node *)
---

# /opencode:result

fetch and display the result of a completed opencode job.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/opencode-companion.mjs" result [<job-id>]
```

return the complete result payload verbatim, including job id, verdict, findings, artifacts, and next steps.
