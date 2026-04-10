# opencode-plugin-cc

use [OpenCode](https://opencode.ai) from inside [Claude Code](https://docs.anthropic.com/en/docs/claude-code) for code reviews or to delegate tasks.

## commands

| command | description |
|---------|-------------|
| `/opencode:setup` | check opencode installation and auth |
| `/opencode:review` | run code review on current changes |
| `/opencode:rescue` | delegate a task to opencode |
| `/opencode:agents` | list available opencode agents |
| `/opencode:models` | list available models (optionally by provider) |
| `/opencode:sessions` | list recent opencode sessions |
| `/opencode:status` | show running and recent jobs |
| `/opencode:result` | show output from a completed job |
| `/opencode:cancel` | cancel a running background job |

## requirements

- node.js 18.18+
- [opencode cli](https://opencode.ai) installed and authenticated
- claude code

## installation

```bash
claude plugin add opencode-plugin-cc
```

or install from source:

```bash
git clone https://github.com/schmayterling/opencode-plugin-cc
cd opencode-plugin-cc
claude plugin add .
```

## setup

after installing, verify everything is working:

```
/opencode:setup
```

## usage

### code review

review your current working tree changes:

```
/opencode:review
```

review against a specific base branch:

```
/opencode:review --base main
```

run a review in the background:

```
/opencode:review --background
```

### task delegation

delegate a bug fix or investigation to opencode:

```
/opencode:rescue fix the failing test in auth.test.ts
```

run in the background:

```
/opencode:rescue --background investigate the memory leak in the worker pool
```

### job management

check job status:

```
/opencode:status
```

get results from a completed job:

```
/opencode:result <job-id>
```

cancel a running job:

```
/opencode:cancel <job-id>
```

## architecture

the plugin wraps the `opencode` CLI via `opencode run` for non-interactive task execution. background jobs are managed through detached node processes with state persisted in `.opencode-plugin/jobs/`.

```
plugins/opencode/
  commands/      slash command definitions
  agents/        subagent definitions (rescue delegation)
  hooks/         session lifecycle hooks
  prompts/       system prompts for review tasks
  schemas/       JSON schemas for structured output
  scripts/       runtime scripts (companion, lifecycle hooks, lib/)
  skills/        internal skills (cli runtime, result handling)
```

## license

Apache-2.0
