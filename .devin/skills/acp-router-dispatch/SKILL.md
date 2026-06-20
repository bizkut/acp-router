# acp-router-dispatch

Dispatch a coding task to a local ACP agent (OpenCode, Claude Code, Codex) via the
`acp-router-cli` CLI. This skill wraps the full dispatch flow into a single shell
command so you don't need multiple MCP tool round-trips.

## When to use

- You need to delegate a code implementation task to an external coding agent.
- You want the agent to work in an isolated git worktree.
- You want to avoid multi-round MCP tool calls (discover_agents → run_agent → tail_job_events → get_job).

## Prerequisites

- `acp-router-cli` CLI installed (`npm install -g @peanut996/acp-router` or `npm link` from repo).
- At least one ACP agent installed: `opencode`, `claude-agent-acp`, or `codex-acp`.

## Quick start

```bash
# Dispatch a task (blocks until agent completes)
acp-router-cli run \
  --worktree /path/to/worktree \
  --prompt "Create fib.py with a fibonacci function and test_fib.py with 4 unit tests" \
  --agent opencode \
  --stream

# Auto-select agent
acp-router-cli run --worktree /path/to/wt --prompt "Fix the bug in auth.py" --stream

# List available agents
acp-router-cli agents

# Check job status
acp-router-cli job <jobId>

# Tail events for a running job
acp-router-cli tail <jobId>
```

## Dispatch script

For a complete dispatch flow (create worktree → run agent → collect result → cleanup),
use the `dispatch.sh` script:

```bash
bash .devin/skills/acp-router-dispatch/dispatch.sh \
  --repo /path/to/repo \
  --branch feat/my-feature \
  --prompt "Implement feature X" \
  --agent opencode
```

The script will:
1. Create a git worktree from the specified branch
2. Run the agent via `acp-router-cli run --stream`
3. Print the job result (changed files, summary, errors)
4. Leave the worktree in place for inspection (use `--cleanup` to auto-remove on success)

## Options

| Option | Description | Default |
|---|---|---|
| `--repo` | Git repo path (required) | - |
| `--branch` | Branch to create worktree from | current branch |
| `--prompt` | Task prompt (required) | - |
| `--agent` | Agent id | auto-select |
| `--timeout-sec` | Timeout in seconds | 3600 |
| `--permission-profile` | plan / acceptEdits / bypassPermissions | bypassPermissions |
| `--cleanup` | Remove worktree on success | false |
| `--stream` | Stream events to stderr | true |

## Permission profiles

| Profile | Behavior |
|---|---|
| `bypassPermissions` | Agent can write files and run commands without approval |
| `acceptEdits` | Agent can write files, but non-file permissions are cancelled |
| `plan` | All permissions cancelled (read-only mode) |

## Tips

- Use `--stream` to see real-time progress in stderr while the job runs.
- The worktree is left after completion. Check `git diff` in the worktree to review changes.
- If the agent fails, check the job log at `~/.acp-router/logs/<jobId>.jsonl`.
- Use `acp-router-cli sessions` to list past sessions and continue them.
