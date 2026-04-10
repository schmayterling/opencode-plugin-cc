---
name: setup
description: Check OpenCode installation and authentication status.
disable_model_invocation: true
allowed_tools:
  - Bash(node *)
  - AskUserQuestion
---

# /opencode:setup

run the setup check:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/opencode-companion.mjs" setup --json
```

report the result to the user verbatim.

if opencode is not installed, suggest installation:
- `npm install -g opencode` or `npx opencode`
- visit https://opencode.ai for other options

if not authenticated, suggest running `opencode auth login`.
