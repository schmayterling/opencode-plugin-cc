---
name: opencode-result-handling
user_invocable: false
description: Internal guidance for presenting OpenCode output to the user.
---

# opencode result handling

## critical rule

after presenting review findings or task results, STOP. do NOT auto-apply fixes, modify files, or take action unless the user explicitly asks.

## presentation rules

- preserve the original verdict, findings order, file paths, line numbers, and evidence boundaries.
- do not summarize, reorder, or editorialize the output.
- if the output contains structured JSON (review results), render it as readable markdown with severity indicators.
- if the output is malformed or empty, report the error and suggest running `/opencode:setup`.

## error handling

- if opencode is not installed, direct to `/opencode:setup`.
- if authentication fails, suggest `opencode auth login`.
- if a job is not found, suggest `/opencode:status --all` to list recent jobs.
