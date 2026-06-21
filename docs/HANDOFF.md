# ACP Router Handoff

Last updated: 2026-06-20, Asia/Shanghai

## Snapshot

- Product name: ACP Router
- Package name: `@peanut996/acp-router` (npm, published)
- Repo: `https://github.com/peanut996/acp-router`
- Local repo: `/Users/peanut996/Workspace/acp-router` (on branch `master`)
- Default branch: `master`
- Current version: `0.9.4` (package.json); `0.9.3` published on npm
- MCP server name: `acp-router`
- MCP server transport: stdio
- bin entries: `acp-router` and `acp-router-cli` via `dist/bin/acp-router.js` and `dist/bin/acp-router-cli.js`
- MCP SDK: `@modelcontextprotocol/sdk` ^1.29.0
- Language: TypeScript (migrated from JavaScript in v0.8.0)
- Build: `tsgo` (TypeScript native preview compiler)
- Package manager: pnpm
- Data directory: `~/.acp-router/`

## Source Inventory

Current checked-in product docs:

- `README.md`: public product overview, quick start, MCP client setup, tools reference, ACP-only mode, supported agents, configuration, data directory, recursion guard, plan mode violation detection, development instructions.
- `docs/MCP_CLIENT_SETUP.md`: detailed MCP client configuration guide.
- `docs/HANDOFF.md`: this document.

Source code (TypeScript, in `src/`):

- `src/acp-client.ts`
- `src/agents.ts`
- `src/constants.ts`
- `src/jobs.ts`
- `src/server.ts`
- `src/storage.ts`
- `src/utils.ts`
- `src/bin/acp-router-cli.ts`

Removed in the v0.8.0 TypeScript migration:

- `mcp/server.mjs` (replaced by `src/server.ts` and the `src/*.ts` modules).
- `scripts/` (smoke and e2e test scripts, removed in favor of `npm run check` plus manual validation).

## Product Boundary

ACP Router is a generic MCP server for routing coding tasks to local ACP agents. It works with any MCP-compatible client (Claude Desktop, Cursor, Windsurf, Codex, etc.) and is no longer tied to Codex as a plugin.

In scope:

- Discover installed local coding agents and their ACP adapter status.
- Read ACP Registry metadata for known adapters, with local caching.
- Configure defaults and safety flags through MCP tools.
- Run external agents against an existing absolute worktree via ACP stdio.
- Track jobs, sessions, event logs, process PID metadata, changed files, and failure reasons.
- List, read, continue, cancel, archive, and tail jobs/sessions through MCP tools.
- Automatic npx fallback when an ACP executable is not on PATH but the registry has an npx distribution.
- Recursion guard via `ACP_ROUTER_DEPTH` env var (max depth 3).
- Probe agents for available models and pass a selected model to `run_agent`.
- Map `permissionProfile` to per-agent ACP modes (plan / acceptEdits / bypassPermissions).

Out of scope:

- CLI fallback adapters (removed in v0.7.0; ACP-only mode).
- Automatic adapter installation (install hints are surfaced, but users install tools themselves).
- Automatic commit, push, PR, or conflict resolution.
- Cloud or multi-tenant scheduling.
- Native UI integration for any specific MCP client.

## Implemented MCP Tools

ACP Router exposes 9 MCP tools:

- `discover_agents` -- discover local coding agents and ACP status; supports `excludeAgent` param to exclude the caller's own agent id from results (avoids self-dispatch).
- `get_agent_models` -- probe an agent for its available model list (added in v0.8.0).
- `manage_config` -- get/set config (action: "get" | "set").
- `run_agent` -- run a coding agent in a worktree (ACP-only, with recursion guard, permissionProfile to ACP mode mapping, optional model param).
- `list_jobs` -- list jobs.
- `get_job` -- get job details.
- `tail_job_events` -- tail job events.
- `cancel_job` -- cancel a job.
- `manage_sessions` -- list/read/continue/archive sessions (4 actions; `read` action added in v0.9.4 to load conversation history).

### Tool consolidation mapping (v0.6.8 to v0.7.0)

| v0.6.8 tool | v0.7.0 tool | Notes |
| --- | --- | --- |
| `discover_coding_agents` | `discover_agents` | Renamed |
| `get_coding_agent_dispatcher_config` | `manage_config` (action: "get") | Merged into `manage_config` |
| `configure_coding_agent_dispatcher` | `manage_config` (action: "set") | Merged into `manage_config` |
| `run_coding_agent` | `run_agent` | Renamed; ACP-only |
| `list_coding_agent_jobs` | `list_jobs` | Renamed |
| `get_coding_agent_job` | `get_job` | Renamed |
| `tail_coding_agent_job_events` | `tail_job_events` | Renamed |
| `cancel_coding_agent_job` | `cancel_job` | Renamed |
| `list_coding_agent_sessions` | `manage_sessions` (action: "list") | Merged into `manage_sessions` |
| `continue_coding_agent_session` | `manage_sessions` (action: "continue") | Merged into `manage_sessions` |
| `archive_coding_agent_session` | `manage_sessions` (action: "archive") | Merged into `manage_sessions` |

### Tools added after v0.7.0

| Version | Tool | Notes |
| --- | --- | --- |
| v0.8.0 | `get_agent_models` | Probes an agent for available models. |
| v0.9.4 | `manage_sessions` (action: "read") | Loads conversation history for a session. |

## Supported Agents

| Agent | ACP Support | Launch Method |
| --- | --- | --- |
| OpenCode | Native ACP stdio | `opencode acp --cwd <worktree>` |
| Cursor Agent | Native ACP via `agent acp` | `agent acp` (pre-authenticate with `agent login`) |
| Claude Code | ACP via `claude-agent-acp` | `claude-agent-acp` or npx fallback |
| Codex CLI | ACP via `codex-acp` | `codex-acp` or npx fallback |
| Devin | Native ACP via `devin acp` | `devin acp` |

## ACP_MODE_MAP

`permissionProfile` to ACP mode mapping, defined in `src/constants.ts` as `ACP_MODE_MAP` and applied via `session/set_config_option` in `src/acp-client.ts`. The router also performs smart approve/cancel based on the profile.

| permissionProfile | claude | codex | opencode | cursor-agent | devin |
| --- | --- | --- | --- | --- | --- |
| `plan` | `plan` | `read-only` | `plan` | `plan` | `plan` |
| `acceptEdits` | `acceptEdits` | `auto` | `build` | `agentic` | `acceptEdits` |
| `bypassPermissions` | `bypassPermissions` | `full-access` | `build` | `agentic` | `bypassPermissions` |

## Current Capability Progress

| Area | Status | Notes |
| --- | --- | --- |
| MCP server | Done | TypeScript, `@modelcontextprotocol/sdk`, stdio transport. |
| Agent discovery | Done | Finds opencode, cursor-agent, claude, codex, devin; `excludeAgent` param avoids self-dispatch. |
| ACP Registry metadata | Done | Reads registry metadata, caches it locally, exposes ids/icons/versions/install hints. No auto-install. |
| npx fallback | Done | When ACP executable not on PATH but registry has npx distribution, auto-launches via `npx --yes <package>`. |
| ACP-only mode | Done | CLI fallback removed and dead code cleaned up in PR #4. Agents without ACP hard-fail with install hint. |
| Recursion guard | Done | `ACP_ROUTER_DEPTH` env var, max depth 3. Prevents infinite agent dispatch loops. |
| permissionProfile to ACP mode mapping | Done | `ACP_MODE_MAP` in `src/constants.ts`, applied via `session/set_config_option` in `src/acp-client.ts`; smart approve/cancel based on profile. |
| Run jobs | Done | Sync and async runs supported. Worktree must be existing absolute path. ACP-only. |
| Job tracking | Done | Registry records job/session state, process PID metadata, status, changed files, logs, and errors. |
| Event tailing | Done | `tail_job_events` supports polling with `afterEventIndex`. |
| Cancellation | Done | Active child processes can be cancelled; persisted process metadata records kill attempts. |
| Restart recovery | Done | Orphaned running jobs are marked and recorded child PIDs are best-effort terminated. |
| Session management | Done | list/read/continue/archive consolidated into `manage_sessions`. |
| Model selection | Done | `get_agent_models` tool plus `model` param on `run_agent`. |
| Safety | Done | Worktree absolute-path requirement, per-worktree lock, permission profiles, plan mode violation detection. |

## Release Timeline

- `v0.6.6`: added `tail_coding_agent_job_events` for near-real-time polling.
- `v0.6.7`: added ACP Registry metadata/cache, ACP-first routing for OpenCode/Claude/Codex, generalized ACP stdio execution and native session-list aggregation.
- `v0.6.8`: added real no-model ACP adapter handshake smoke for `claude-agent-acp` and `codex-acp`, registry version fallback for ACP adapters that do not support version probing, and PATH-priority fixes for equal/unknown versions.
- `v0.7.0`: refactor from Codex-specific plugin to generic MCP server. Repo/package renamed from `codex-agent-router` to `acp-router`. Codex plugin packaging removed. MCP server migrated to `@modelcontextprotocol/sdk`. Data directory changed from `~/.codex/agent-router/` to `~/.acp-router/`. Tools consolidated from 11 to 8. ACP-only mode (CLI fallback removed). npx fallback for ACP adapters. Recursion guard via `ACP_ROUTER_DEPTH`. Hard cut, no backward compatibility with v0.6.x data.
- `v0.8.0`: TypeScript migration (migrated from `.mjs` to `src/*.ts`). pnpm package manager. `get_agent_models` tool added. `model` param on `run_agent`. CLI `models` command. Plan mode violation detection.
- `v0.9.0`: Gemini CLI and Devin agent support added.
- `v0.9.1`: Replaced Gemini with Cursor Agent ACP support.
- `v0.9.2` (unreleased): Removed default agent recommendation from `discover_agents`. Exclude caller agent from `discover_agents` results. Replaced `ACP_ROUTER_CALLER` env var with `excludeAgent` tool param.
- `v0.9.4` (current, unreleased): Added session `read` action to `manage_sessions` for loading conversation history.

## Latest Validation Evidence

No-model validation listed in `README.md`:

```bash
npm run check
```

`npm run check` is typecheck only (via `tsgo`). No runtime tests exist -- the smoke and e2e scripts were removed in the v0.8.0 TypeScript migration in favor of `npm run check` plus manual validation via MCP clients.

Known real E2E acceptance from prior releases:

- OpenCode ACP file-edit E2E passed with model `opencode-go/glm-5.2`.
- OpenCode session lifecycle E2E passed.
- Claude ACP handshake validated (v0.6.8).
- Codex ACP handshake validated (v0.6.8).

## Important Runtime Paths

- Config: `~/.acp-router/config.json`
- Job/session registry: `~/.acp-router/registry.json`
- Logs: `~/.acp-router/logs/`
- ACP Registry cache: `~/.acp-router/acp-registry-cache.json`
- Override: set `ACP_ROUTER_DATA_DIR` env var to use a custom data directory.

## Current Defaults

- `launchExternalAgents=true`
- `inheritEnvironment=true`
- `allowCurrentDirectory=false`
- `requireAbsoluteWorktree=true`
- `defaultPermissionProfile="bypassPermissions"`
- `allowBypassPermissions=true`
- Registry enabled by default.
- Registry URL: `https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json`
- Registry cache TTL: 86400 seconds (24 hours).
- Max recursion depth: 3 (`ACP_ROUTER_DEPTH`).

## Known Gaps

1. v0.9.4 not yet published to npm (npm has v0.9.3).
2. No git tags for v0.7.x through v0.9.x releases (last tag is v0.6.8).
3. Real ACP prompt/file-edit E2E for `claude-agent-acp` and `codex-acp` via the npx fallback path not yet documented as passed (smoke scripts were removed in favor of `npm run check` plus manual validation).
4. Native ACP session-list/continue behavior proven for OpenCode; other adapters need real session-list/continue/read acceptance.
5. Registry-driven adapter expansion is still manual (5 built-in agents mapped; no dynamic registry-driven profile generation yet).
6. No automatic adapter installation (install hints surfaced, users install themselves).

## Recommended Next Work

1. Publish v0.9.4 to npm (`pnpm build && npm publish`).

2. Tag releases v0.7.0 through v0.9.4 on GitHub for traceability.

3. Run real ACP E2E for Claude, Codex, Cursor Agent, and Devin -- verify file-edit tasks complete successfully with `permissionProfile=acceptEdits`.

4. Verify session `read` action works across all adapters (not just OpenCode).

5. Consider registry-driven adapter expansion: auto-generate router profiles from ACP Registry metadata instead of hard-coding `BUILT_IN_AGENTS`.

6. Consider adding tests (the smoke/e2e scripts were removed; `npm run check` is typecheck only -- no runtime tests exist).

## Fresh Session Prompt

Copy this into a new session:

```text
Continue ACP Router development.

Repo: /Users/peanut996/Workspace/acp-router
Branch: master
GitHub: https://github.com/peanut996/acp-router
Current version: 0.9.4 (package.json); 0.9.3 published on npm
npm package: @peanut996/acp-router
Language: TypeScript (src/*.ts, tsgo build, pnpm)

Do these first:
1. git -C /Users/peanut996/Workspace/acp-router status
2. Confirm branch is master.
3. Use ACP Router. First call discover_agents.
4. If you cannot see discover_agents or run_agent, report that tools are not injected.

Current product state:
- Generic MCP server, works with any MCP client (Claude Desktop, Cursor, Windsurf, Codex, etc.).
- MCP server built on @modelcontextprotocol/sdk, stdio transport, TypeScript.
- Data directory: ~/.acp-router/
- ACP-only mode. CLI fallback removed and dead code cleaned up (PR #4).
- npx fallback when ACP executable not on PATH but registry has npx distribution.
- Recursion guard: ACP_ROUTER_DEPTH, max depth 3.
- permissionProfile to ACP mode mapping (ACP_MODE_MAP in src/constants.ts).
- Plan mode violation detection.
- 9 tools: discover_agents, get_agent_models, manage_config, run_agent, list_jobs, get_job, tail_job_events, cancel_job, manage_sessions.
- 5 agents: OpenCode (native ACP), Cursor Agent (agent acp), Claude (claude-agent-acp or npx), Codex (codex-acp or npx), Devin (devin acp).
- ACP Registry metadata/cache integrated.
- Model selection: get_agent_models tool + model param on run_agent.

Next priorities:
- Publish v0.9.4 to npm (pnpm build && npm publish).
- Tag releases v0.7.0 through v0.9.4 on GitHub.
- Run real ACP E2E for Claude, Codex, Cursor Agent, and Devin with permissionProfile=acceptEdits.
- Verify session read action across all adapters.
- Consider registry-driven adapter expansion and adding runtime tests.
```

## Refactor Notes (v0.6.8 to v0.7.0)

### What changed

1. **Repo/package rename**: `codex-agent-router` renamed to `acp-router`. `package.json` name, repository URL, bin entry, and description all updated.

2. **Codex plugin packaging removed**: `.codex-plugin/`, `skills/`, `.mcp.json`, `.agents/` directories deleted. ACP Router is no longer a Codex plugin; it is a standalone npm package and MCP server.

3. **MCP server migration**: Migrated from hand-rolled JSON-RPC handling to `@modelcontextprotocol/sdk` (`McpServer` + `StdioServerTransport`). Tool registration uses `server.tool()` with Zod schemas. This provides proper MCP protocol compliance and automatic schema generation.

4. **Data directory changed**: `~/.codex/agent-router/` changed to `~/.acp-router/`. Hard cut, no backward compatibility. Existing v0.6.x users need to reconfigure. Override available via `ACP_ROUTER_DATA_DIR` env var.

5. **Tools consolidated from 11 to 8**:
   - Config get/set merged into `manage_config` with `action` param.
   - Session list/continue/archive merged into `manage_sessions` with `action` param.
   - All tool names shortened (removed `coding_agent` infix).

6. **ACP-only mode**: CLI fallback adapters removed. `run_agent` only supports ACP stdio transport. Agents without an available ACP adapter hard-fail with `acp_required` error and an install hint. `executeAndPersistJobRun` throws on non-`acp_stdio` launch kinds.

7. **npx fallback**: When an ACP executable is not on PATH but the ACP Registry lists an npx distribution for that agent, ACP Router automatically launches the adapter via `npx --yes <package>`. The agent's `acp.launchMode` is set to `"npx"` and `acp.launchCommand` contains the npx command. `isAcpRunReady` and `resolveAcpLaunchTarget` both handle the npx case.

8. **Recursion guard**: `ACP_ROUTER_DEPTH` env var tracks dispatch depth. `createJob` checks depth at the start and fails with `recursion_limit` if >= 3. `AcpStdioClient.start` increments the depth in the child process environment. This prevents infinite loops when an ACP agent itself calls ACP Router.

9. **bin entry**: `acp-router` command via `./bin/acp-router.mjs`, which imports and calls `startMcpServer()` from `mcp/server.mjs`.

10. **Version**: Bumped to `0.7.0`.

### What was removed

- Codex plugin manifest (`.codex-plugin/plugin.json`).
- Codex bundled skill (`skills/agent-router/SKILL.md`).
- Codex marketplace entry (`.agents/plugins/marketplace.json`).
- Codex-specific MCP config (`.mcp.json`).
- Codex plugin install instructions from README.
- English and Chinese usage guides (`docs/USAGE.md`, `docs/USAGE.zh-CN.md`).
- CLI fallback as a runtime path (code still present but unreachable at this point; cleaned up later in PR #4).

### What was not changed

- ACP stdio client implementation (`AcpStdioClient`).
- ACP Registry metadata reading and caching.
- Job/session registry persistence and orphan recovery.
- Worktree validation and locking.
- Permission profiles and safety defaults.
- Smoke and E2E test scripts (still present at this point; removed in v0.8.0).

## Refactor Notes (v0.7.0 to v0.8.0, TypeScript Migration)

### What changed

1. **JavaScript to TypeScript**: All source migrated from `.mjs` files to `src/*.ts` modules. `mcp/server.mjs` was split into `src/server.ts`, `src/acp-client.ts`, `src/agents.ts`, `src/constants.ts`, `src/jobs.ts`, `src/storage.ts`, `src/utils.ts`. The CLI entry moved to `src/bin/acp-router-cli.ts`.

2. **Package manager**: Switched from npm to pnpm.

3. **Build toolchain**: Adopted `tsgo` (TypeScript native preview compiler) for typechecking and build. bin entries now point at `dist/bin/acp-router.js` and `dist/bin/acp-router-cli.js` (compiled output).

4. **bin entries**: Two bin entries now -- `acp-router` (MCP server) and `acp-router-cli` (CLI helper).

5. **`get_agent_models` tool added**: Probes an agent for its available model list and surfaces them in `availableModels`.

6. **`model` param on `run_agent`**: Allows selecting a specific model when launching an agent.

7. **CLI `models` command**: Added to `acp-router-cli` for listing models from the command line.

8. **Plan mode violation detection**: Added detection for plan mode violations (agent editing files when running in `plan` profile).

9. **Smoke and e2e scripts removed**: `scripts/` directory deleted in favor of `npm run check` (typecheck) plus manual validation via MCP clients.

### What was removed

- `mcp/server.mjs` (replaced by `src/*.ts` modules).
- `scripts/` smoke and e2e test scripts.
- Any remaining `.mjs` source files.

### What was not changed

- ACP-only mode, npx fallback, recursion guard, and all v0.7.0 runtime behavior.
- ACP Registry metadata reading and caching.
- Job/session registry persistence and orphan recovery.
- Worktree validation and locking.
- Permission profiles and safety defaults.
