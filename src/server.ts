#!/usr/bin/env node

import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { toToolResult, safeEnv } from "./utils.js";
import { readConfig } from "./storage.js";
import { discoverAgents, configureDispatcher } from "./agents.js";
import { probeAgentModels } from "./acp-client.js";
import {
  createJob,
  listJobs,
  getJob,
  tailJobEvents,
  cancelJob,
  listSessions,
  continueSession,
  archiveSession
} from "./jobs.js";

async function startMcpServer(): Promise<void> {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  const registerTool = server.tool.bind(server) as any;

  registerTool(
    "discover_agents",
    "Discover locally installed coding agents and their ACP adapter status. Returns transport, ACP availability, registry metadata, and install hints.",
    {
      refresh: z.boolean().optional().describe("Force refresh the ACP registry cache"),
      includeNotInstalled: z.boolean().optional().describe("Include agents that are not currently installed"),
      excludeAgent: z.string().optional().describe("Agent id to exclude from results (e.g. pass your own agent id to avoid self-dispatch)")
    },
    async (args: any) => toToolResult(await discoverAgents({
      refresh: args.refresh === true,
      includeNotInstalled: args.includeNotInstalled !== false,
      excludeAgent: typeof args.excludeAgent === "string" ? args.excludeAgent : undefined
    }))
  );

  registerTool(
    "get_agent_models",
    "Probe an ACP agent for its available model list. Starts a temporary ACP session, reads config options, and returns model choices. Use this before run_agent to discover valid model ids.",
    {
      agent: z.string().describe("Agent id to probe (e.g. opencode, claude, codex)"),
      worktree: z.string().optional().describe("Worktree path for the ACP session (defaults to cwd)"),
      excludeAgent: z.string().optional().describe("Agent id to exclude from discovery (pass your own id to avoid self-dispatch)")
    },
    async (args: any) => {
      const config = await readConfig();
      const { agents } = await discoverAgents({ includeNotInstalled: false, excludeAgent: args.excludeAgent });
      const selectedAgent = agents.find((a: any) => a.id === args.agent);
      if (!selectedAgent) {
        return toToolResult({ error: "agent_not_found", agentId: args.agent, availableAgents: agents.map((a: any) => a.id) });
      }
      if (!selectedAgent.acp?.available) {
        return toToolResult({ error: "acp_not_available", agentId: args.agent });
      }
      try {
        const result = await probeAgentModels({
          selectedAgent,
          worktree: args.worktree,
          env: safeEnv({ inheritEnvironment: config.safety.inheritEnvironment === true })
        });
        return toToolResult(result);
      } catch (error) {
        return toToolResult({ error: "probe_failed", agentId: args.agent, message: (error as Error).message });
      }
    }
  );

  registerTool(
    "manage_config",
    "Get or set Agent Router configuration including default agent, per-mode defaults, disabled agents, and safety policy.",
    {
      action: z.enum(["get", "set"]).describe("Get or set config"),
      defaultAgent: z.string().nullable().optional().describe("Default agent id to use when none is explicitly requested"),
      disabledAgents: z.array(z.string()).optional().describe("Agent ids to exclude from automatic selection"),
      allowCurrentDirectory: z.boolean().optional().describe("Allow dispatching agents in the current working directory"),
      registryEnabled: z.boolean().optional().describe("Enable ACP registry lookups for agent discovery"),
      registryUrl: z.string().optional().describe("ACP registry URL override"),
      registryCacheTtlSec: z.number().optional().describe("ACP registry cache TTL in seconds"),
      launchExternalAgents: z.boolean().optional().describe("Allow launching external agent processes"),
      allowBypassPermissions: z.boolean().optional().describe("Allow bypassPermissions permission profile"),
      defaultPermissionProfile: z.enum(["plan", "acceptEdits", "bypassPermissions"]).optional().describe("Default permission profile for new jobs"),
      inheritEnvironment: z.boolean().optional().describe("Inherit parent process environment for child agents"),
      modeDefaults: z.record(z.string(), z.unknown()).optional().describe("Per-mode default agent id mapping")
    },
    async (args: any) => {
      if (args.action === "get") {
        return toToolResult({ config: await readConfig() });
      }
      return toToolResult(await configureDispatcher(args));
    }
  );

  registerTool(
    "run_agent",
    "Run a coding agent in an isolated worktree. Requires an absolute worktree path. Supports sync and async execution. ACP-only — CLI fallback is not supported.",
    {
      agent: z.string().nullable().optional().describe("Agent id to run; omit for automatic selection"),
      worktree: z.string().describe("Absolute path to the worktree directory"),
      prompt: z.string().describe("Task prompt to send to the agent"),
      mode: z.string().optional().describe("Execution mode (e.g. implementation, planning)"),
      async: z.boolean().optional().describe("Return immediately and run the job in the background"),
      sessionId: z.string().nullable().optional().describe("Existing session id to continue"),
      timeoutSec: z.number().optional().describe("Job timeout in seconds"),
      permissionProfile: z.enum(["plan", "acceptEdits", "bypassPermissions"]).optional().describe("Permission profile for the agent"),
      model: z.string().optional().describe("Model id to use (agent-specific, e.g. opencode model id). Use discover_agents or get_job to see availableModels."),
      collectDiff: z.boolean().optional().describe("Collect git diff before and after the run"),
      launchExternalAgents: z.boolean().optional().describe("Override config for launching external agents"),
      inheritEnvironment: z.boolean().optional().describe("Override config for inheriting parent environment"),
      metadata: z.record(z.string(), z.unknown()).optional().describe("Arbitrary metadata to attach to the job")
    },
    async (args: any) => toToolResult(await createJob(args))
  );

  registerTool(
    "list_jobs",
    "List Agent Router jobs from the local registry with optional filters.",
    {
      status: z.string().nullable().optional().describe("Filter by job status"),
      agent: z.string().nullable().optional().describe("Filter by agent id"),
      worktree: z.string().nullable().optional().describe("Filter by worktree path"),
      limit: z.number().optional().describe("Maximum number of jobs to return")
    },
    async (args: any) => toToolResult(await listJobs(args))
  );

  registerTool(
    "get_job",
    "Get an Agent Router job by id.",
    {
      jobId: z.string().describe("Job id to look up")
    },
    async (args: any) => toToolResult(await getJob(args))
  );

  registerTool(
    "tail_job_events",
    "Return newly recorded Agent Router job events from the JSONL event log for polling-style progress updates.",
    {
      jobId: z.string().describe("Job id to tail events for"),
      afterEventIndex: z.number().optional().describe("Return events after this index"),
      limit: z.number().optional().describe("Maximum number of events to return"),
      includeLogTail: z.boolean().optional().describe("Include a tail of the raw log file"),
      logTailBytes: z.number().optional().describe("Number of bytes to include in the log tail")
    },
    async (args: any) => toToolResult(await tailJobEvents(args))
  );

  registerTool(
    "cancel_job",
    "Cancel an Agent Router job and terminate an active child process when the current MCP server owns it.",
    {
      jobId: z.string().describe("Job id to cancel"),
      reason: z.string().optional().describe("Reason for cancellation")
    },
    async (args: any) => toToolResult(await cancelJob(args))
  );

  registerTool(
    "manage_sessions",
    "List, continue, or archive Agent Router sessions. Use action='list' to enumerate sessions, action='continue' to resume a session with a new prompt, or action='archive' to mark a session as archived.",
    {
      action: z.enum(["list", "continue", "archive"]).describe("Session action to perform"),
      includeArchived: z.boolean().optional().describe("Include archived sessions in list results"),
      agent: z.string().optional().describe("Filter by agent id (list) or specify agent for continue"),
      worktree: z.string().optional().describe("Filter by worktree path (list) or specify worktree for continue"),
      limit: z.number().optional().describe("Maximum number of sessions to return (list)"),
      sessionId: z.string().optional().describe("Session id to continue or archive"),
      prompt: z.string().optional().describe("Prompt to send when continuing a session"),
      async: z.boolean().optional().describe("Return immediately and run the job in the background (continue)"),
      launchExternalAgents: z.boolean().optional().describe("Override config for launching external agents (continue)"),
      inheritEnvironment: z.boolean().optional().describe("Override config for inheriting parent environment (continue)"),
      timeoutSec: z.number().optional().describe("Job timeout in seconds (continue)")
    },
    async (args: any) => {
      if (args.action === "list") {
        return toToolResult(await listSessions({
          includeArchived: args.includeArchived,
          agent: args.agent,
          worktree: args.worktree,
          limit: args.limit
        }));
      }
      if (args.action === "continue") {
        if (!args.sessionId) {
          return toToolResult({
            sessionId: null,
            status: "failed",
            error: "missing_session_id",
            message: "sessionId is required when action is 'continue'."
          });
        }
        return toToolResult(await continueSession({
          agent: args.agent,
          sessionId: args.sessionId,
          prompt: args.prompt,
          worktree: args.worktree,
          async: args.async,
          launchExternalAgents: args.launchExternalAgents,
          inheritEnvironment: args.inheritEnvironment,
          timeoutSec: args.timeoutSec
        }));
      }
      if (args.action === "archive") {
        if (!args.sessionId) {
          return toToolResult({
            sessionId: null,
            status: "failed",
            error: "missing_session_id",
            message: "sessionId is required when action is 'archive'."
          });
        }
        return toToolResult(await archiveSession({ sessionId: args.sessionId }));
      }
      return toToolResult({
        status: "failed",
        error: "invalid_action",
        message: `Unknown session action: ${args.action}`
      });
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = async (): Promise<void> => {
    try {
      await server.close();
    } catch {
      // Ignore errors during shutdown
    }
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

export { startMcpServer };

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startMcpServer().catch((err: Error) => {
    process.stderr.write(`acp-router: ${err.message}\n`);
    process.exit(1);
  });
}
