---
name: models
description: List available OpenCode models.
arguments: "[provider] [--verbose] [--refresh]"
disable_model_invocation: true
allowed_tools:
  - Bash(node *)
---

# /opencode:models

list available opencode models, optionally filtered by provider.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/opencode-companion.mjs" models \
  [<provider>] [--verbose] [--refresh]
```

if a provider is given (e.g. `anthropic`, `openai`), only show models from that provider.
`--verbose` includes metadata like costs.
`--refresh` refreshes the model cache.

return the output verbatim.
