---
name: cancel
description: Cancel an active OpenCode background job.
arguments: "[job-id]"
disable_model_invocation: true
allowed_tools:
  - Bash(node *)
---

# /opencode:cancel

cancel a running opencode background job.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/opencode-companion.mjs" cancel [<job-id>]
```

if no job id is given and there is exactly one active job, cancel it.
if multiple jobs are active, list them and ask which to cancel.
