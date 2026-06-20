#!/usr/bin/env node

import { createJob, getJob, tailJobEvents, listJobs, cancelJob, listSessions } from "../mcp/jobs.mjs";
import { discoverAgents } from "../mcp/agents.mjs";
import { configureDispatcher } from "../mcp/agents.mjs";
import { readConfig } from "../mcp/storage.mjs";

const HELP = `agent-router-mcp CLI

Usage: agent-router <command> [options]

Commands:
  run       Run a coding agent in a worktree (sync, blocks until done)
  agents    List discovered agents
  jobs      List jobs
  job       Get job details
  tail      Tail job events
  cancel    Cancel a running job
  sessions  List sessions
  config    Get or set config

Run "agent-router <command> --help" for command-specific options.
`;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._ = args._ || [];
      args._.push(arg);
    }
  }
  return args;
}

function printJson(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
}

async function cmdRun(args) {
  if (args.help) {
    process.stdout.write(`agent-router run -- Run a coding agent (sync, blocks until done)

Options:
  --worktree <path>     Absolute path to worktree (required)
  --prompt <text>       Task prompt (required)
  --agent <id>          Agent id (default: auto-select)
  --mode <mode>         Execution mode (default: implementation)
  --timeout-sec <n>     Timeout in seconds (default: 3600)
  --permission-profile <p>  plan | acceptEdits | bypassPermissions (default: bypassPermissions)
  --model <id>             Model id to use (agent-specific)
  --collect-diff <bool>     Collect git diff (default: true)
  --session-id <id>     Continue an existing session
  --stream              Stream events to stderr while running
`);
    return;
  }
  if (!args.worktree || !args.prompt) {
    process.stderr.write("Error: --worktree and --prompt are required\n");
    process.exit(1);
  }
  const wantStream = args.stream === true;
  const jobArgs = {
    worktree: args.worktree,
    prompt: args.prompt,
    agent: args.agent,
    mode: args.mode,
    timeoutSec: args["timeout-sec"] ? Number(args["timeout-sec"]) : undefined,
    permissionProfile: args["permission-profile"],
    model: args.model,
    collectDiff: args["collect-diff"] === "false" ? false : undefined,
    sessionId: args["session-id"],
    async: wantStream
  };
  const result = await createJob(jobArgs);
  if (wantStream && result.jobId) {
    let lastIndex = -1;
    while (true) {
      const tail = await tailJobEvents({ jobId: result.jobId, afterEventIndex: lastIndex, limit: 50 });
      for (const event of tail.events) {
        process.stderr.write(`[${event.type}] ${event.message || ""}\n`);
        lastIndex = event.eventIndex ?? lastIndex;
      }
      if (tail.status !== "running" && tail.status !== "starting" && tail.status !== "queued") break;
      await new Promise((r) => setTimeout(r, 500));
    }
    const final = await getJob({ jobId: result.jobId });
    printJson(final);
  } else {
    printJson(result);
  }
}

async function cmdAgents(args) {
  const result = await discoverAgents({
    refresh: args.refresh === true,
    includeNotInstalled: args["include-not-installed"] !== "false"
  });
  printJson(result);
}

async function cmdJobs(args) {
  const result = await listJobs({
    status: args.status,
    agent: args.agent,
    worktree: args.worktree,
    limit: args.limit ? Number(args.limit) : undefined
  });
  printJson(result);
}

async function cmdJob(args) {
  if (!args._ || !args._[0]) {
    process.stderr.write("Error: job id required\n");
    process.exit(1);
  }
  const result = await getJob({ jobId: args._[0] });
  printJson(result);
}

async function cmdTail(args) {
  if (!args._ || !args._[0]) {
    process.stderr.write("Error: job id required\n");
    process.exit(1);
  }
  const result = await tailJobEvents({
    jobId: args._[0],
    afterEventIndex: args["after-event-index"] ? Number(args["after-event-index"]) : undefined,
    limit: args.limit ? Number(args.limit) : undefined,
    includeLogTail: args["include-log-tail"] === true,
    logTailBytes: args["log-tail-bytes"] ? Number(args["log-tail-bytes"]) : undefined
  });
  printJson(result);
}

async function cmdCancel(args) {
  if (!args._ || !args._[0]) {
    process.stderr.write("Error: job id required\n");
    process.exit(1);
  }
  const result = await cancelJob({ jobId: args._[0], reason: args.reason });
  printJson(result);
}

async function cmdSessions(args) {
  const result = await listSessions({
    includeArchived: args["include-archived"] === true,
    agent: args.agent,
    worktree: args.worktree,
    limit: args.limit ? Number(args.limit) : undefined
  });
  printJson(result);
}

async function cmdConfig(args) {
  if (args.set) {
    const setArgs = {};
    for (const key of ["defaultAgent", "disabledAgents", "allowCurrentDirectory", "registryEnabled", "registryUrl", "registryCacheTtlSec", "launchExternalAgents", "allowBypassPermissions", "inheritEnvironment"]) {
      if (args[key] !== undefined) setArgs[key] = args[key];
    }
    const result = await configureDispatcher({ action: "set", ...setArgs });
    printJson(result);
  } else {
    const config = await readConfig();
    printJson({ config });
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const rest = argv.slice(1);

  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(HELP);
    return;
  }

  const args = parseArgs(rest);

  switch (command) {
    case "run": await cmdRun(args); break;
    case "agents": await cmdAgents(args); break;
    case "jobs": await cmdJobs(args); break;
    case "job": await cmdJob(args); break;
    case "tail": await cmdTail(args); break;
    case "cancel": await cmdCancel(args); break;
    case "sessions": await cmdSessions(args); break;
    case "config": await cmdConfig(args); break;
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${HELP}`);
      process.exit(1);
  }
}

main().catch((error) => {
  process.stderr.write(`agent-router: ${error.message}\n`);
  process.exit(1);
});
