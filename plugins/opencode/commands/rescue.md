---
name: rescue
description: Delegate investigation, a fix, or follow-up work to OpenCode.
context: fork
arguments: "[--background] [--model <model>] [task text]"
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
2. forward the task to the `opencode:opencode-rescue` agent using the `task` command:

```
task opencode:opencode-rescue [--background] [--model <model>] <task text>
```

3. the subagent handles execution and returns results.
