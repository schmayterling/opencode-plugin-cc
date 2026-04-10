---
name: review
description: Run OpenCode code review on current changes.
arguments: "[--wait|--background] [--base <ref>] [--scope auto|working-tree|branch] [--model <model>]"
disable_model_invocation: true
allowed_tools:
  - Read
  - Glob
  - Grep
  - Bash(node *)
  - Bash(git *)
  - AskUserQuestion
---

# /opencode:review

run a code review using opencode.

## steps

1. estimate the review size by checking `git diff --stat` (or `git diff --stat <base>` if `--base` is provided).
2. if the diff is large (>500 lines) and neither `--wait` nor `--background` was specified, ask the user whether to wait or run in background.
3. run the review:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/opencode-companion.mjs" review \
  [--base <ref>] [--scope <scope>] [--model <model>] \
  [--background | --wait]
```

4. return the output verbatim. do not summarize, reorder, or edit the review findings.
