---
name: rescue
description: Delegate investigation, a fix, or follow-up work to OpenCode.
context: fork
arguments: "[--background] [--model <model>] [--agent <name>] [--resume|--fresh|--session <id>] [task text]"
allowed_tools:
  - Read
  - Glob
  - Grep
  - Bash(node *)
  - Bash(git *)
  - AskUserQuestion
---

# /opencode:rescue

delegate a task to opencode via the `opencode:opencode-rescue` subagent.

## steps

1. if no task text is provided, ask the user what they want opencode to do.
2. check for a resumable session:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/opencode-companion.mjs" resume-candidate --json
```

3. if a session is found and the user did not pass `--fresh`:
   - tell the user about the existing session (id, title, last active).
   - ask if they want to `--resume` (continue it) or `--fresh` (start new).
   - if the user passed `--resume` or `--session <id>`, skip asking.

4. forward the task to the `opencode:opencode-rescue` agent:

```
task opencode:opencode-rescue [--background] [--model <model>] [--agent <name>] [--resume|--fresh|--session <id>] <task text>
```

5. the subagent handles execution and returns results.
