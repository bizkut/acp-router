import { randomUUID } from "node:crypto";

interface RouterOwner {
  instanceId: string;
  pid: number;
  startedAt: string;
}

interface OwnedJob {
  owner?: Partial<RouterOwner> | null;
  process?: { pid?: unknown } | null;
}

const ROUTER_OWNER: RouterOwner = Object.freeze({
  instanceId: randomUUID(),
  pid: process.pid,
  startedAt: new Date().toISOString()
});

function normalizePid(value: unknown): number | null {
  const pid = Number.parseInt(String(value), 10);
  return Number.isSafeInteger(pid) && pid > 0 ? pid : null;
}

function isProcessAlive(pidValue: unknown): boolean {
  const pid = normalizePid(pidValue);
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function isJobOwnedByLiveRouter(job: OwnedJob): boolean {
  const ownerPid = normalizePid(job.owner?.pid);
  if (ownerPid) return isProcessAlive(ownerPid);

  // Jobs written by versions before owner metadata existed are ambiguous. A
  // live child is safer to treat as peer-owned than to kill from another MCP
  // process. Once that child exits, normal orphan recovery may reclaim it.
  const childPid = normalizePid(job.process?.pid);
  return childPid ? isProcessAlive(childPid) : false;
}

function shouldRecoverJob(job: OwnedJob, locallyActive: boolean): boolean {
  if (locallyActive) return false;
  return !isJobOwnedByLiveRouter(job);
}

export {
  ROUTER_OWNER,
  normalizePid,
  isProcessAlive,
  isJobOwnedByLiveRouter,
  shouldRecoverJob
};

export type { RouterOwner, OwnedJob };
