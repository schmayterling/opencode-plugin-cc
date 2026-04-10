---
name: opencode-cli-runtime
user_invocable: false
description: Internal helper contract for calling OpenCode from the rescue agent.
---

# opencode cli runtime

the primary helper is:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/opencode-companion.mjs" task \
  [--background | --wait] \
  [--model <model>] \
  [--write] \
  -- <task text>
```

## rules

- use exactly one `task` invocation per rescue call.
- default to `--write` (write-capable) unless the user explicitly asked for read-only analysis.
- if `--model` is not specified, opencode uses its configured default model.
- for `--background` tasks, the companion script spawns a detached worker and returns a job id immediately.
- for foreground tasks (default), the script blocks until completion and returns output.

## task text

the task text is everything after `--`. pass the user's request as-is, but you may prepend working directory context if helpful.
