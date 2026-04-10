---
name: opencode-cli-runtime
user_invocable: false
description: Internal helper contract for calling OpenCode from the rescue agent.
---

# opencode cli runtime

## IMPORTANT: exact command format

the ONLY valid command is `task`. there is no `run` subcommand. there is no `--prompt` flag.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/opencode-companion.mjs" task -- "the task text here"
```

with options:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/opencode-companion.mjs" task --model provider/model --agent agent-name -- "the task text here"
```

## concrete examples

```bash
# simple task
node "${CLAUDE_PLUGIN_ROOT}/scripts/opencode-companion.mjs" task -- "Say hi to the user"

# with model
node "${CLAUDE_PLUGIN_ROOT}/scripts/opencode-companion.mjs" task --model google/gemini-2.5-pro -- "Explain this code"

# with agent
node "${CLAUDE_PLUGIN_ROOT}/scripts/opencode-companion.mjs" task --agent code-review -- "Review the auth module"

# resume last session
node "${CLAUDE_PLUGIN_ROOT}/scripts/opencode-companion.mjs" task --resume -- "Continue the investigation"

# resume specific session
node "${CLAUDE_PLUGIN_ROOT}/scripts/opencode-companion.mjs" task --session abc123 -- "Pick up from here"

# background
node "${CLAUDE_PLUGIN_ROOT}/scripts/opencode-companion.mjs" task --background -- "Fix the failing tests"
```

## rules

- the task text MUST come after `--`. everything before `--` is flags, everything after is the prompt.
- use exactly one `task` invocation per rescue call.
- if `--model` is not specified, opencode uses its configured default model.
- if `--agent` is specified, opencode uses that agent.
- `--resume` continues the last opencode session. `--session <id>` continues a specific one.
- `--fresh` forces a new session (or just omit all session flags).
- do NOT use `--prompt`, `--quiet`, `-q`, or any other flags not listed above.
