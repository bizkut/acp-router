import assert from "node:assert/strict";
import test from "node:test";

import {
  chooseSessionContinuationMethod,
  continueAcpSession,
  isApprovedPermissionOutcome,
  selectPermissionOutcome
} from "../dist/acp-client.js";

const permissionParams = {
  options: [
    { optionId: "allow_once", kind: "allow_once" },
    { optionId: "allow_session", kind: "allow_always" },
    { optionId: "switch_bypass", kind: "allow_always" },
    { optionId: "reject_once", kind: "reject_once" }
  ]
};

test("permission responses use the ACP tagged outcome envelope", () => {
  const plan = selectPermissionOutcome("plan", permissionParams);
  const edits = selectPermissionOutcome("acceptEdits", permissionParams);
  const bypass = selectPermissionOutcome("bypassPermissions", permissionParams);

  assert.deepEqual(plan, { outcome: "selected", optionId: "reject_once" });
  assert.deepEqual(edits, { outcome: "selected", optionId: "allow_once" });
  assert.deepEqual(bypass, { outcome: "selected", optionId: "switch_bypass" });
  assert.equal(isApprovedPermissionOutcome(plan, permissionParams), false);
  assert.deepEqual(
    { outcome: selectPermissionOutcome("plan", { options: [] }) },
    { outcome: { outcome: "cancelled" } }
  );
});

test("acceptEdits rejects an explicitly non-file legacy permission", () => {
  const params = {
    ...permissionParams,
    permissions: [{ type: "execute" }]
  };
  const outcome = selectPermissionOutcome("acceptEdits", params);
  assert.deepEqual(outcome, { outcome: "selected", optionId: "reject_once" });
  assert.equal(isApprovedPermissionOutcome(outcome, params), false);
});

test("permission selection uses a provided rejection instead of inventing an option", () => {
  const params = { options: [{ optionId: "no", kind: "reject_once" }] };
  const outcome = selectPermissionOutcome("acceptEdits", params);
  assert.deepEqual(outcome, { outcome: "selected", optionId: "no" });
  assert.equal(isApprovedPermissionOutcome(outcome, params), false);
});

test("a permission request without options is cancelled", () => {
  assert.deepEqual(selectPermissionOutcome("bypassPermissions", {}), { outcome: "cancelled" });
});

test("session continuation follows advertised ACP capabilities", () => {
  assert.equal(chooseSessionContinuationMethod({
    agentCapabilities: { sessionCapabilities: { resume: {} }, loadSession: true }
  }), "session/resume");
  assert.equal(chooseSessionContinuationMethod({
    agentCapabilities: { sessionCapabilities: {}, loadSession: true }
  }), "session/load");
  assert.equal(chooseSessionContinuationMethod({
    agentCapabilities: { sessionCapabilities: { resume: false }, loadSession: true }
  }), "session/load");
  assert.equal(chooseSessionContinuationMethod({ agentCapabilities: {} }), null);
});

test("session/resume falls back to session/load only on Method not found", async () => {
  const calls = [];
  const client = {
    async request(method) {
      calls.push(method);
      if (method === "session/resume") throw new Error("session/resume failed: Method not found");
      return { configOptions: [] };
    }
  };
  const result = await continueAcpSession(client, {
    agentCapabilities: { sessionCapabilities: { resume: {} }, loadSession: true }
  }, "provider-session", "/tmp");

  assert.deepEqual(calls, ["session/resume", "session/load"]);
  assert.deepEqual(result, { configOptions: [] });
});

test("legacy loadSession agents are continued with session/load", async () => {
  const calls = [];
  const client = {
    async request(method) {
      calls.push(method);
      return {};
    }
  };
  await continueAcpSession(client, {
    agentCapabilities: { sessionCapabilities: {}, loadSession: true }
  }, "provider-session", "/tmp");
  assert.deepEqual(calls, ["session/load"]);
});

test("continuation fails clearly when the agent advertised no continuation method", async () => {
  await assert.rejects(
    continueAcpSession({ request: async () => ({}) }, { agentCapabilities: {} }, "provider-session", "/tmp"),
    /neither session\/resume nor session\/load was advertised/
  );
});

test("session/resume errors other than Method not found are not masked", async () => {
  const client = { request: async () => { throw new Error("permission denied"); } };
  await assert.rejects(
    continueAcpSession(client, {
      agentCapabilities: { sessionCapabilities: { resume: {} }, loadSession: true }
    }, "provider-session", "/tmp"),
    /permission denied/
  );
});
