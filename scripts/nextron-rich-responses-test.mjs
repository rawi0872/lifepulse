import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const rich = read("src/lib/nextron/rich-response.ts");
const coach = read("src/lib/nextron/coach.ts");
const askRoute = read("src/app/api/nextron/ask/route.ts");
const conversation = read("src/lib/nextron/conversation.ts");
const coachPage = read("src/app/coach/page.tsx");
const actions = read("src/lib/nextron/actions.ts");
const habitsPage = read("src/app/habits/page.tsx");
const insightsPage = read("src/app/insights/page.tsx");

assert(rich.includes("NEXTRON_RICH_RESPONSE_VERSION = \"nextron-rich-response-v1\""), "Rich responses must be versioned.");
assert(rich.includes("modelCalls: 0"), "Rich response generation must not add model calls.");
assert(rich.includes("NextronRichBlockType") && rich.includes("metric_strip") && rich.includes("priority_list") && rich.includes("entity_list") && rich.includes("evidence") && rich.includes("empty_state"), "Rich responses must use a typed whitelist of block kinds.");
assert(rich.includes("SAFE_HREFS") && !rich.includes("dangerouslySetInnerHTML") && !rich.includes("eval("), "Rich responses must not allow arbitrary rendering or endpoints.");
assert(rich.includes("buildNextronRichResponse") && rich.includes("NextronEvidencePacket") && rich.includes("response.supportingEvidence"), "Rich response blocks must be built from existing evidence and response facts.");
assert(rich.includes("isNextronRichResponse") && rich.includes("candidate.modelCalls === 0") && rich.includes("candidate.blocks.length <= MAX_BLOCKS"), "Rich responses must validate persisted blocks before rendering.");
assert(rich.includes("selectRichViewIntent") && rich.includes("request.handlingStatus !== \"handled\"") && rich.includes("return null"), "Rich UI selection must be deterministic and skip unsupported/general non-Life-Pulse requests.");
assert(rich.includes("viewIntent === \"tasks\"") && rich.includes("viewIntent === \"projects\"") && rich.includes("viewIntent === \"goals\"") && rich.includes("viewIntent === \"habits\""), "Rich UI must select targeted domain views instead of dumping every domain for any keyword.");
assert(!/\bid\b\s*:/.test(rich) && !rich.includes("entityId") && !rich.includes("source_id"), "Rich responses must not accept or persist arbitrary entity identifiers.");
assert(!rich.includes("SupabaseClient") && !/supabase\s*\.from\(|\.from\(\"/.test(rich), "Rich responses must not perform ad hoc database resolution outside owner-scoped evidence builders.");

assert(coach.includes("richResponse?: NextronRichResponse"), "Coach response type must carry optional persisted rich UI.");
assert(coach.includes("personalDataViewTerms") && coach.includes("show me my") && coach.includes("tell me about the") && coach.includes("GENERAL_SUPPORTED"), "Coach classifier must recognize personal data-view prompts without making generic concept prompts rich.");
assert(askRoute.includes("buildNextronRichResponse(response, evidence, parsedRequest)") && askRoute.includes("richResponse ? { ...response, richResponse } : response"), "Ask route must attach rich UI in the existing ask call only when useful, not through a second provider call.");
assert(conversation.includes("response: args.assistantResponse"), "Rich UI must persist inside the existing assistant response JSON.");

assert(coachPage.includes("data-nextron-rich-response=\"true\"") && coachPage.includes("RichBlockView") && coachPage.includes("isNextronRichResponse(response.richResponse)"), "NEXTRON UI must render only validated known rich blocks from persisted responses.");
assert(!coachPage.includes("dangerouslySetInnerHTML") && !coachPage.includes("createElement(block") && !coachPage.includes("new Function") && !coachPage.includes("href={item.href ??") && coachPage.includes("<Link href={item.href}"), "Client renderer must not execute generated code, markup, or arbitrary navigation.");

assert(!rich.includes("from(\"") && !askRoute.includes("actions/approve") && !askRoute.includes("actions/cancel"), "Rich responses must not introduce domain mutations or action execution shortcuts.");
assert(actions.includes("requiresApproval: true") && actions.includes("idempotencyKey"), "Prompt 3 action safety contract must remain present while adding rich UI.");

assert(habitsPage.includes("realm_id: string | null") && habitsPage.includes("setRealmId(h.realm_id ?? \"\")") && habitsPage.includes("realm_id: realmId || null"), "Habits UI must handle Prompt 3 null realm habits without rendering or edit crashes.");
assert(insightsPage.includes("Record<string, string | null>") && insightsPage.includes("realmId && realmMap[realmId] !== undefined"), "Insights realm analytics must ignore null-realm habits without inventing a null realm bucket.");

console.log("NEXTRON Rich Response v1 contract checks passed.");
