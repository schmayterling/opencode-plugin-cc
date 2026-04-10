---
name: rescue
description: Delegate investigation, a fix, or follow-up work to OpenCode.
context: fork
arguments: "task text"
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

## model selection

if the user mentions a specific provider or model family (e.g. "use gemini", "with gpt-5"), resolve it to the latest available version:

1. run: `node "${CLAUDE_PLUGIN_ROOT}/scripts/opencode-companion.mjs" models` and filter for that provider.
2. pick the most capable/latest model from the results (prefer non-mini, non-nano, latest version number).
3. pass it as `--model provider/model`.

if the user doesn't mention a model, omit the flag (opencode uses its default).

## session resume

default behavior is to start fresh. only resume if the user explicitly asks (e.g. "continue", "resume", "pick up where we left off").

if the user explicitly asks to resume:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/opencode-companion.mjs" resume-candidate --json
```

if a session is found, pass `--resume`. if not, tell the user there's nothing to resume.

do NOT check for resume candidates or ask about resuming unless the user explicitly requests it.

## steps

1. if no task text is provided, ask the user what they want opencode to do.
2. forward the task to the `opencode:opencode-rescue` agent:

```
task opencode:opencode-rescue [--model provider/model] [--agent name] [--resume] <task text>
```

3. the subagent handles execution and returns results.
