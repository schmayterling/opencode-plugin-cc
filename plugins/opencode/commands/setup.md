---
name: setup
description: Check OpenCode installation, authentication, and show usage guidance.
disable_model_invocation: true
allowed_tools:
  - Bash(node *)
  - AskUserQuestion
---

# /opencode:setup

check opencode installation, authenticated providers, and show usage guidance.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/opencode-companion.mjs" setup --json
```

report the result to the user verbatim. it includes:
- installation status and version
- authenticated providers (e.g. github copilot, openai, anthropic)
- model format guide (`provider/model`)
- quick reference for all commands
- note about `--background` vs claude code's ctrl+b

if opencode is not installed, suggest installation.
if not authenticated, suggest `opencode auth login`.
