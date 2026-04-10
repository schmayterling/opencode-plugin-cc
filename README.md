# opencode-plugin-cc

use [OpenCode](https://opencode.ai) from inside [Claude Code](https://docs.anthropic.com/en/docs/claude-code) for code reviews or to delegate tasks.

## commands

| command | description |
|---------|-------------|
| `/opencode:setup` | check installation, auth, and show usage guide |
| `/opencode:rescue` | delegate a task to opencode |
| `/opencode:review` | run code review on current changes |
| `/opencode:agents` | list available opencode agents |
| `/opencode:models` | list available models by provider |
| `/opencode:sessions` | list recent opencode sessions |
| `/opencode:status` | show running and recent background jobs |
| `/opencode:result` | show output from a completed background job |
| `/opencode:cancel` | cancel a running background job |

## requirements

- node.js 18.18+
- [opencode cli](https://opencode.ai) installed and authenticated
- claude code

## installation

### from github

```bash
claude plugin marketplace add https://github.com/schmayterling/opencode-plugin-cc
claude plugin install opencode
```

### from local source

```bash
git clone https://github.com/schmayterling/opencode-plugin-cc
claude plugin marketplace add /path/to/opencode-plugin-cc
claude plugin install opencode
```

## setup

### 1. install opencode

```bash
npm install -g opencode
```

or see https://opencode.ai for other options.

### 2. authenticate with a provider

```bash
opencode auth login
```

opencode supports 75+ providers including openai, anthropic, google, and github copilot. if you have github copilot, it works automatically via oauth.

### 3. verify in claude code

```
/opencode:setup
```

this shows your installed version, authenticated providers, available model slugs, and a quick reference for all commands.

## usage

### task delegation

delegate work to opencode. it picks the best available model automatically.

```
/opencode:rescue fix the failing test in auth.test.ts
```

specify a provider or model:

```
/opencode:rescue --model github-copilot/claude-sonnet-4.6 refactor the auth module
```

use a specific agent:

```
/opencode:rescue --agent code-review review the payment flow
```

### session resume

opencode tracks sessions. you can continue where a previous task left off:

```
/opencode:rescue --resume continue investigating the memory leak
```

or resume a specific session:

```
/opencode:rescue --session abc123 pick up from here
```

list recent sessions:

```
/opencode:sessions
```

### code review

review your current working tree changes:

```
/opencode:review
```

review against a specific base branch:

```
/opencode:review --base main
```

### background jobs

any command supports `--background` to run in the background with job tracking:

```
/opencode:rescue --background investigate the memory leak in the worker pool
```

check status, get results, or cancel:

```
/opencode:status
/opencode:result <job-id>
/opencode:cancel <job-id>
```

note: this is different from claude code's ctrl+b (which backgrounds the bash command itself without creating a trackable job).

### model and agent discovery

```
/opencode:models              # list all available models
/opencode:models anthropic    # filter by provider
/opencode:agents              # list available agents
```

models use `provider/model` format (e.g. `github-copilot/claude-sonnet-4.6`, `google/gemini-3.1-pro-preview`). run `/opencode:models` to see exact slugs.

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
