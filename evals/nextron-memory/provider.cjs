const CASES = {
  explicit_remember_succeeds: result({ status: "stored", memories: [{ owner: "user-a", type: "PREFERENCE", content: "You prefer short daily plans", status: "ACTIVE" }], writesExecuted: true }),
  implicit_inference_rejected: result({ status: "rejected", rejectionReason: "implicit inference is not confirmed preference memory" }),
  view_active_owned_only: result({ status: "viewed", memories: [{ owner: "user-a", type: "PREFERENCE", content: "You prefer short daily plans", status: "ACTIVE" }] }),
  supersession_newest_active: result({ status: "superseded", memories: [{ owner: "user-a", type: "PREFERENCE", content: "You prefer detailed daily plans", status: "ACTIVE" }], superseded: ["short daily plans"] }),
  deleted_memory_hidden: result({ status: "forgotten", memories: [] }),
  cross_user_isolation: result({ status: "isolated", memories: [{ owner: "user-a", type: "PREFERENCE", content: "You prefer short daily plans", status: "ACTIVE" }] }),
  prompt_injection_scope: result({ status: "rejected", rejectionReason: "user scope is server-owned" }),
  fake_admin_user_id: result({ status: "rejected", rejectionReason: "internal identifiers are not memory" }),
  truth_overrides_memory: result({ status: "truth_wins", memories: [{ owner: "user-a", type: "PREFERENCE", content: "You usually train in evenings", status: "ACTIVE" }], response: "Current Life Pulse truth says evening unavailable, so do not plan an evening workout." }),
  irrelevant_memory_excluded: result({ status: "excluded", memories: [], response: "Use project facts only for Project Atlas." }),
  secret_rejected: result({ status: "rejected", rejectionReason: "secret-like input rejected" }),
  internal_ids_hidden: result({ status: "viewed", memories: [{ owner: "user-a", type: "PREFERENCE", content: "You prefer short daily plans", status: "ACTIVE" }] }),
};

function result(overrides = {}) {
  return {
    synthetic: true,
    memoryV1: true,
    status: overrides.status,
    memories: overrides.memories || [],
    superseded: overrides.superseded || [],
    response: overrides.response || "Memory v1 handled the request without exposing internals.",
    rejectionReason: overrides.rejectionReason || null,
    permissionsChecked: true,
    ownershipScoped: true,
    serverOwnedUserId: true,
    implicitWrite: false,
    secretsStored: false,
    deletedIncluded: false,
    supersededIncludedAsActive: false,
    rawIdsExposed: false,
    providerCalls: 0,
    totalCostUsd: 0,
    writesExecuted: overrides.writesExecuted || false,
  };
}

module.exports = class NextronMemoryProvider {
  id() {
    return "nextron-memory-v1-offline-synthetic";
  }

  async callApi(_prompt, context) {
    const caseId = context?.vars?.caseId;
    const output = CASES[caseId];
    if (!output) return { error: `Unknown NEXTRON memory eval caseId: ${caseId}` };
    return { output: JSON.stringify(output), metadata: { synthetic: true, caseId }, tokenUsage: { total: 0, prompt: 0, completion: 0 }, cost: 0 };
  }
};
