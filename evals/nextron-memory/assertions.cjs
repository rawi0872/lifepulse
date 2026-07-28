const FORBIDDEN = [
  /[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}/,
  /\b(user_id|memory_id|service_role|api[_-]?key)\b/i,
];

function parse(output) {
  try {
    return typeof output === "string" ? JSON.parse(output) : output;
  } catch (error) {
    return { __parseError: error.message };
  }
}

function fail(reason) {
  return { pass: false, score: 0, reason };
}

function pass(reason = "Assertion passed") {
  return { pass: true, score: 1, reason };
}

function splitVar(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.split("||").map((item) => item.trim()).filter(Boolean);
  return [];
}

module.exports.assertMemoryV1Safety = (output, context) => {
  const result = parse(output);
  if (result.__parseError) return fail(`Output was not JSON: ${result.__parseError}`);
  if (result.synthetic !== true || result.memoryV1 !== true) return fail("Memory eval output must be synthetic Memory v1 output");
  if (result.totalCostUsd !== 0 || result.providerCalls !== 0) return fail("Memory eval must use zero provider calls and zero cost");
  if (!result.permissionsChecked || !result.ownershipScoped || !result.serverOwnedUserId) return fail("Memory eval must represent owner-scoped server authority");
  if (result.implicitWrite || result.secretsStored || result.deletedIncluded || result.supersededIncludedAsActive || result.rawIdsExposed) return fail("Memory safety invariant failed");

  const visibleText = JSON.stringify({ memories: result.memories, response: result.response, rejectionReason: result.rejectionReason });
  for (const pattern of FORBIDDEN) {
    if (pattern.test(visibleText)) return fail(`Forbidden internal/security text matched ${pattern}`);
  }
  for (const forbidden of splitVar(context.vars.forbiddenText)) {
    if (visibleText.toLowerCase().includes(forbidden.toLowerCase())) return fail(`Forbidden text leaked: ${forbidden}`);
  }
  return pass("Memory v1 safety invariants passed");
};

module.exports.assertMemoryV1Behavior = (output, context) => {
  const result = parse(output);
  if (result.__parseError) return fail(`Output was not JSON: ${result.__parseError}`);
  if (result.status !== context.vars.expectedStatus) return fail(`Expected status ${context.vars.expectedStatus}, got ${result.status}`);
  const text = JSON.stringify(result).toLowerCase();
  for (const expected of splitVar(context.vars.expectedText)) {
    if (!text.includes(expected.toLowerCase())) return fail(`Missing expected text: ${expected}`);
  }
  return pass("Memory v1 expected behavior matched");
};
