#!/usr/bin/env tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { CORE_HEALTH_METRICS, HEALTH_METRIC_META, buildHealthDedupeKey, isValidHealthNumericValue, isCoreMetric } from "@lifepulse/domain";
import { isStorageAllowed, isNextronAllowed, DEFAULT_HEALTH_PRIVACY } from "@lifepulse/domain";

let passed=0, failed=0;
function assert(c:boolean, m:string){ if(c){ passed++; console.log(`  PASS ${m}`);} else { failed++; console.error(`  FAIL ${m}`);} }

console.log("=== Core metric set ===");
assert(CORE_HEALTH_METRICS.length===6, `core count 6 got ${CORE_HEALTH_METRICS.length}`);
assert(CORE_HEALTH_METRICS.includes("sleep_duration"), "contains sleep_duration");
assert(!CORE_HEALTH_METRICS.includes("sleep_start" as any), "no sleep_start");
assert(!CORE_HEALTH_METRICS.includes("sleep_end" as any), "no sleep_end");
assert(isCoreMetric("steps") && !isCoreMetric("hrv" as any), "isCoreMetric correct");

console.log("\n=== Metric/unit ===");
assert(HEALTH_METRIC_META.sleep_duration.unit==="minutes", "sleep_duration minutes");
assert(HEALTH_METRIC_META.steps.unit==="count", "steps count");
assert(HEALTH_METRIC_META.weight.unit==="kg", "weight kg");
assert(HEALTH_METRIC_META.resting_heart_rate.unit==="bpm", "rhr bpm");

console.log("\n=== Dedupe ===");
const k1=buildHealthDedupeKey({sourceRecordId:"abc123", metricType:"steps", recordedAt:"2026-08-25T08:00:00Z", startAt:null, endAt:null});
const k1b=buildHealthDedupeKey({sourceRecordId:"abc123", metricType:"steps", recordedAt:"2026-08-25T08:00:00Z", startAt:null, endAt:null});
assert(k1===k1b && k1==="sid:abc123", "sid stable");
const k2=buildHealthDedupeKey({sourceRecordId:null, metricType:"sleep_duration", recordedAt:"2026-08-26T06:30:00Z", startAt:"2026-08-25T22:00:00Z", endAt:"2026-08-26T06:30:00Z"});
const k2b=buildHealthDedupeKey({sourceRecordId:null, metricType:"sleep_duration", recordedAt:"2026-08-26T06:30:00Z", startAt:"2026-08-25T22:00:00Z", endAt:"2026-08-26T06:30:00Z"});
assert(k2===k2b && k2.startsWith("sleep_duration:"), "fallback deterministic");
assert(k1.length>0 && k2.length>0, "non-empty");
assert(k1!==k2, "differs");

console.log("\n=== Validation bounds ===");
assert(isValidHealthNumericValue("steps", 5000), "steps 5000 valid");
assert(!isValidHealthNumericValue("steps", -1), "steps negative invalid");
assert(isValidHealthNumericValue("resting_heart_rate", 60), "rhr 60 valid");
assert(!isValidHealthNumericValue("resting_heart_rate", 300), "rhr 300 invalid");
assert(isValidHealthNumericValue("weight", 70), "weight 70 valid");
assert(!isValidHealthNumericValue("sleep_duration", 2000), "sleep 2000 invalid");

console.log("\n=== Consent ===");
const s1 = { ...DEFAULT_HEALTH_PRIVACY, storageConsent:{allowedScopes:["steps" as any], updatedAt:null}, nextronAccess:{allowed:false, allowedScopes:[], updatedAt:null}};
assert(isStorageAllowed(s1,"steps" as any), "storage steps allowed");
assert(!isStorageAllowed(s1,"weight" as any), "storage weight not allowed");
assert(!isNextronAllowed(s1,"steps" as any), "nextron blocked when off");
const s2 = { ...DEFAULT_HEALTH_PRIVACY, storageConsent:{allowedScopes:["steps" as any,"weight" as any], updatedAt:null}, nextronAccess:{allowed:true, allowedScopes:["steps" as any], updatedAt:null}};
assert(isNextronAllowed(s2,"steps" as any), "nextron steps allowed");
assert(!isNextronAllowed(s2,"weight" as any), "nextron weight blocked");

console.log(`\n--- Summary ${passed} passed, ${failed} failed ---`);
if(failed>0) process.exit(1);
console.log("HEALTH FOUNDATION TS — ALL PASS");
