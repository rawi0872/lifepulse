import {
  getBodyDailySummary,
  getBodyMetricTrend,
  getBodyGoalProgress,
  deriveBodySignals,
  createBodyPrivacyBoundary,
  classifyMetricQuality,
  formatBodyMetricValue,
} from "../packages/domain/body";

let pass=0, fail=0;
function assert(c:boolean,label:string){ if(c){pass++;console.log(`  PASS ${label}`);} else {fail++; console.log(`  FAIL ${label}`);} }

// daily summary
const today = getBodyDailySummary({ date:"2026-09-02", healthRecords:[{metric:"steps", value:8000, recorded_at:"2026-09-02T12:00:00Z", source:"health_connect"}], allowedMetrics:["steps"]});
assert(today.availableMetrics.includes("steps"), "today steps available");
assert(today.missingMetrics.includes("weight"), "today weight missing");
assert(today.metrics.steps.isZeroVsMissing==="present", "present not missing");
assert(today.activityLevel==="active", "activity active");

const empty = getBodyDailySummary({ date:"2026-09-02", healthRecords:[], allowedMetrics:["steps"]});
assert(empty.freshness==="empty" && !empty.isSufficient, "empty insufficient");
assert(empty.metrics.steps.quality==="missing", "missing quality");
assert(empty.metrics.steps.isZeroVsMissing==="missing", "missing vs zero");

const zero = getBodyDailySummary({ date:"2026-09-02", healthRecords:[{metric:"steps", value:0, recorded_at:"2026-09-02T12:00:00Z", source:"health_connect"}], allowedMetrics:["steps"]});
assert(zero.metrics.steps.value===0 && zero.metrics.steps.isZeroVsMissing==="zero", "zero vs missing distinguished");

// consent filtering
const filtered = getBodyDailySummary({ date:"2026-09-02", healthRecords:[{metric:"weight", value:80, recorded_at:"2026-09-02T12:00:00Z", source:"health_connect"}], allowedMetrics:["steps"]});
assert(filtered.metrics.weight.value==null, "consent filters weight");

// trend insufficient
const ins = getBodyMetricTrend([{date:"2026-09-01", value:5000}], "steps", 7);
assert(!ins.isSufficient && ins.direction==="insufficient", "trend insufficient");

// trend sufficient
const hist = Array.from({length:14},(_,i)=>({date:`2026-08-${String(15+i).padStart(2,"0")}`, value: i<7?5000:6000}));
const trend = getBodyMetricTrend(hist, "steps", 7);
assert(trend.isSufficient && trend.currentAvg!==null && trend.previousAvg!==null, "trend sufficient");
assert(trend.direction==="up", "trend up");

// weight trend flat
const wTrend = getBodyMetricTrend([{date:"2026-09-01", value:80},{date:"2026-09-02", value:80.1}], "weight", 7);
assert(wTrend.direction==="flat" || !wTrend.isSufficient, "weight flat or insufficient");

// goal progress
const gp = getBodyGoalProgress({kind:"steps_average", targetValue:8000}, 4000);
assert(gp.status==="behind" && gp.progress01===0.5, "goal behind");
const gp2 = getBodyGoalProgress({kind:"weight_target", targetValue:82}, 82);
assert(gp2.status==="achieved", "weight achieved");
const gpIns = getBodyGoalProgress({kind:"sleep_duration", targetValue:450}, null);
assert(gpIns.status==="insufficient", "goal insufficient");

// signals bounded
const sigs = deriveBodySignals({ dueBodyHabits:[{id:"1", title:"Workout"}], goalProgress:[{kind:"steps_average", progress01:0.4, status:"behind", currentValue:4000, targetValue:8000, message:"behind"}], todaySteps:2000, stepsTarget:8000, sleepMinutes:300, sleepTargetMinutes:450});
assert(sigs.length<=3, "signals bounded");
assert(sigs[0].kind==="body_habit_due", "habit due first");

// privacy
const b = createBodyPrivacyBoundary(["steps"], false);
assert(b.storageAllowed("steps") && !b.nextronAllowed("steps"), "nextron blocked when off");
const b2 = createBodyPrivacyBoundary(["steps"], true);
assert(b2.nextronAllowed("steps"), "nextron allowed when on");

// missing vs stale
assert(classifyMetricQuality(10, new Date(Date.now()-100*3600*1000).toISOString())==="stale", "stale");

// format
assert(formatBodyMetricValue("sleepDuration", 90)==="1h 30m", "sleep format");
assert(formatBodyMetricValue("weight", 82)==="82.0 kg", "weight kg");
assert(formatBodyMetricValue("weight", 82, {weightUnit:"lb"}).includes("lb"), "weight lb");

console.log(`--- Summary ${pass} passed, ${fail} failed ---`);
if(fail>0) process.exit(1); else console.log("BODY FOUNDATION TS — ALL PASS");
