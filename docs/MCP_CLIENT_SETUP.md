# MCP Client Setup Guide

This guide covers how to configure ACP Router with various MCP clients, troubleshoot common issues, and use environment variables to customize behavior.

## Prerequisites

- **Node.js >= 18** -- check with `node --version`
- **npm** -- comes bundled with Node.js
- At least one ACP-capable coding agent installed (see [Supported Agents](../README.md#supported-agents))

## Installation Options

### Option 1: npx (recommended)

No installation required. `npx` downloads and runs ACP Router on demand:

```bash
npx @peanut996/acp-router
```

This is the simplest option and ensures you always run the latest published version. All client config examples below use `npx`.

### Option 2: Global npm install

Install once, then run the `acp-router` command directly:

```bash
npm install -g @peanut996/acp-router
acp-router
```

When using a global install, client configs can use `"command": "acp-router"` with an empty args array instead of `npx`.

### Option 3: Clone from source

For development or running unreleased changes:

```bash
git clone https://github.com/peanut996/acp-router.git
cd acp-router
npm install
npm start
```

For client configs pointing at a local clone, use the full path to the bin entry:

```json
{
  "mcpServers": {
    "acp-router": {
      "command": "node",
      "args": ["/path/to/acp-router/bin/acp-router.mjs"]
    }
  }
}
```

## Client-Specific Configuration

### Claude Desktop

**Config file location:**

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

**Config:**

```json
{
  "mcpServers": {
    "acp-router": {
      "command": "npx",
      "args": ["@peanut996/acp-router"]
    }
  }
}
```

After saving the file, fully quit and restart Claude Desktop. The ACP Router tools will appear in the tool list.

If you installed ACP Router globally, use this instead:

```json
{
  "mcpServers": {
    "acp-router": {
      "command": "acp-router"
    }
  }
}
```

### Cursor

**Config file location:** `.cursor/mcp.json` in your project root, or the user-level Cursor settings.

**Config:**

```json
{
  "mcpServers": {
    "acp-router": {
      "command": "npx",
      "args": ["@peanut996/acp-router"]
    }
  }
}
```

Reload the Cursor window after saving (Command+Shift+P > "Reload Window" on macOS).

### Windsurf

**Config file location:** Windsurf MCP server settings (via UI or config file, depending on version).

**Config:**

```json
{
  "mcpServers": {
    "acp-router": {
      "command": "npx",
      "args": ["@peanut996/acp-router"]
    }
  }
}
```

Restart Windsurf after saving the config.

### Codex

**Config file location:** `.mcp.json` in your project root.

**Config:**

```json
{
  "mcpServers": {
    "acp-router": {
      "command": "npx",
      "args": ["@peanut996/acp-router"]
    }
  }
}
```

Codex picks up the MCP server from the project-level `.mcp.json` on the next session.

### Generic MCP Client

Any client that supports stdio MCP servers can launch ACP Router. The server communicates over stdin/stdout using the Model Context Protocol.

| Parameter | Value |
| --- | --- |
| Command | `npx` |
| Args | `["acp-router"]` |
| Transport | stdio |
| Server name | `acp-router` |
| Server version | `0.7.0` |

If your client requires a full command string instead of a JSON config:

```bash
npx @peanut996/acp-router
```

## Environment Variables

ACP Router supports two environment variables. Set them in the `env` field of your MCP client config:

### ACP_ROUTER_DATA_DIR

Overrides the data directory location. Defaults to `~/.acp-router/`.

```json
{
  "mcpServers": {
    "acp-router": {
      "command": "npx",
      "args": ["@peanut996/acp-router"],
      "env": {
        "ACP_ROUTER_DATA_DIR": "/path/to/custom/data/dir"
      }
    }
  }
}
```

Use this when you want to isolate ACP Router data per project, run tests, or store data on a different volume.

### ACP_ROUTER_DEPTH

Tracks the current recursion depth for the agent dispatch loop. ACP Router sets this automatically when launching child agents -- you normally do not need to set it manually.

The maximum allowed depth is **3**. If you need to change the starting depth for testing or nested dispatch scenarios, set it in the env config:

```json
{
  "mcpServers": {
    "acp-router": {
      "command": "npx",
      "args": ["@peanut996/acp-router"],
      "env": {
        "ACP_ROUTER_DEPTH": "0"
      }
    }
  }
}
```

## Verifying the Setup

After configuring your MCP client, verify that ACP Router is working:

1. **Check tool injection** -- Ask your MCP client to list available tools. You should see 8 tools: `discover_agents`, `manage_config`, `run_agent`, `list_jobs`, `get_job`, `tail_job_events`, `cancel_job`, `manage_sessions`.

2. **Run discovery** -- Ask the client to call `discover_agents`:

   ```text
   Discover local coding agents with ACP Router.
   ```

   The response should list all agents found on your system with their ACP status.

3. **Run a test job** -- Create a temporary git worktree and dispatch a simple task:

   ```text
   Use ACP Router to run opencode in /path/to/worktree.
   Append one line to note.txt, then report the job id, session id, and changed files.
   ```

## Troubleshooting

### Server not starting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Client reports "server failed to start" | Node.js not found or version < 18 | Install Node.js >= 18 and ensure it is on PATH |
| Client reports "command not found: npx" | npm not installed or not on PATH | Install Node.js which includes npm |
| Server starts but immediately exits | `acp-router` package not found | Run `npx @peanut996/acp-router` manually in a terminal to trigger the initial download |
| Permission denied on data directory | `~/.acp-router/` not writable | Check directory permissions or set `ACP_ROUTER_DATA_DIR` to a writable path |

### Tools not appearing

| Symptom | Cause | Fix |
| --- | --- | --- |
| No ACP Router tools in the client | Config file not loaded | Restart the client after editing the config; verify the JSON is valid |
| Only some tools appear | Client filters tools by name or capability | Check the client's tool filtering settings |
| Tools appear but calls fail | Server process crashed or hung | Check the client's MCP server logs for stderr output |

### ACP not found

| Symptom | Cause | Fix |
| --- | --- | --- |
| `run_agent` fails with `acp_required` | Selected agent has no ACP adapter on PATH and no npx distribution | Install the ACP adapter (see the install hint in the error message) |
| `run_agent` fails with `acp_required` for Cursor Agent | Cursor Agent has no ACP adapter at all | Use a different agent (opencode, claude, or codex) |
| Agent discovered but ACP status is "not available" | ACP executable not on PATH | Install the ACP adapter or rely on npx fallback |
| npx fallback is slow | First `npx` run downloads the package | Subsequent runs use the npm cache and are faster |
| `discover_agents` shows no agents | No coding agents installed | Install at least one supported agent (opencode, claude, codex) |

### Debugging tips

- Run ACP Router standalone to see stderr output:

  ```bash
  npx @peanut996/acp-router
  ```

  The server reads JSON-RPC messages from stdin and writes responses to stdout. Any errors or diagnostics go to stderr.

- Check the data directory for state:

  ```bash
  ls -la ~/.acp-router/
  cat ~/.acp-router/config.json
  cat ~/.acp-router/registry.json
  ```

- Inspect job logs for failure details:

  ```bash
  cat ~/.acp-router/logs/<jobId>.jsonl
  ```

- Use `ACP_ROUTER_DATA_DIR` to isolate a test run from your real data:

  ```bash
  ACP_ROUTER_DATA_DIR=/tmp/acp-router-test npx @peanut996/acp-router
  ```
