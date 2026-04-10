---
name: status
description: Show running and recent OpenCode jobs.
arguments: "[job-id] [--wait] [--timeout-ms <ms>] [--all]"
disable_model_invocation: true
allowed_tools:
  - Bash(node *)
---

# /opencode:status

show the status of opencode jobs.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/opencode-companion.mjs" status \
  [<job-id>] [--wait] [--timeout-ms <ms>] [--all]
```

if no job id is given, show a compact markdown table of recent jobs.
if a job id is given, show full details for that job.
if `--wait` is specified, poll until the job completes (default timeout: 300000ms).
return the output verbatim.
