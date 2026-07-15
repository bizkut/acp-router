import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const storageUrl = pathToFileURL(path.join(repoRoot, "dist/storage.js")).href;

function spawnSleeper() {
  return spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: "ignore"
  });
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function stop(child) {
  if (!child || child.exitCode != null || child.signalCode != null) return;
  child.kill("SIGTERM");
  await new Promise((resolve) => child.once("exit", resolve));
}

async function waitForExit(child) {
  if (child.exitCode != null || child.signalCode != null) return;
  await new Promise((resolve) => child.once("exit", resolve));
}

async function makeRegistry(job) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "acp-router-recovery-"));
  const registry = {
    jobs: { [job.jobId]: job },
    sessions: {
      [job.sessionId]: {
        sessionId: job.sessionId,
        lastJobId: job.jobId,
        status: "running",
        providerSessionId: "provider-session"
      }
    }
  };
  await writeFile(path.join(dataDir, "registry.json"), `${JSON.stringify(registry, null, 2)}\n`);
  return dataDir;
}

async function recover(dataDir) {
  const source = `const storage = await import(${JSON.stringify(storageUrl)}); process.stdout.write(JSON.stringify(await storage.recoverOrphanedJobs()));`;
  const { stdout } = await execFileAsync(process.execPath, ["--input-type=module", "-e", source], {
    env: { ...process.env, ACP_ROUTER_DATA_DIR: dataDir }
  });
  return JSON.parse(stdout);
}

async function readRegistry(dataDir) {
  return JSON.parse(await readFile(path.join(dataDir, "registry.json"), "utf8"));
}

test("a second router process does not recover or kill a live peer's job", async (t) => {
  const peer = spawnSleeper();
  const child = spawnSleeper();
  t.after(async () => stop(peer));
  t.after(async () => stop(child));
  const job = {
    jobId: "peer-job",
    sessionId: "peer-session",
    agentId: "devin",
    status: "running",
    owner: { instanceId: "peer-router", pid: peer.pid, startedAt: new Date().toISOString() },
    process: { pid: child.pid, status: "running" }
  };
  const dataDir = await makeRegistry(job);
  t.after(() => rm(dataDir, { recursive: true, force: true }));

  assert.deepEqual(await recover(dataDir), { recoveredCount: 0 });
  assert.equal(alive(peer.pid), true);
  assert.equal(alive(child.pid), true);
  assert.equal((await readRegistry(dataDir)).jobs[job.jobId].status, "running");
});

test("a job whose owning router died is recovered and its child is terminated", async (t) => {
  const child = spawnSleeper();
  t.after(async () => stop(child));
  const job = {
    jobId: "orphan-job",
    sessionId: "orphan-session",
    agentId: "devin",
    status: "running",
    owner: { instanceId: "dead-router", pid: 2147483647, startedAt: new Date().toISOString() },
    process: { pid: child.pid, status: "running" }
  };
  const dataDir = await makeRegistry(job);
  t.after(() => rm(dataDir, { recursive: true, force: true }));

  assert.deepEqual(await recover(dataDir), { recoveredCount: 1 });
  await waitForExit(child);
  assert.equal(alive(child.pid), false);
  assert.equal((await readRegistry(dataDir)).jobs[job.jobId].status, "orphaned");
});

test("legacy jobs with a live recorded child are not killed", async (t) => {
  const child = spawnSleeper();
  t.after(async () => stop(child));
  const job = {
    jobId: "legacy-job",
    sessionId: "legacy-session",
    agentId: "devin",
    status: "running",
    process: { pid: child.pid, status: "running" }
  };
  const dataDir = await makeRegistry(job);
  t.after(() => rm(dataDir, { recursive: true, force: true }));

  assert.deepEqual(await recover(dataDir), { recoveredCount: 0 });
  assert.equal(alive(child.pid), true);
});
