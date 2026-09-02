import { createBodyPrivacyBoundary, buildBodyNextronEvidence, getBodyGoalProgress, deriveBodySignals, type BodyMetricKey } from "../packages/domain/body";

let p=0,f=0; const ok=(c:boolean,l:string)=>{ if(c){p++;console.log(`  PASS ${l}`);} else {f++; console.log(`  FAIL ${l}`);} };

// permission
const b1 = createBodyPrivacyBoundary(["steps"], false);
ok(!b1.nextronAllowed("steps"), "storage ON + NEXTRON OFF → excluded");
const b2 = createBodyPrivacyBoundary(["steps"], true);
ok(b2.nextronAllowed("steps"), "storage ON + NEXTRON ON → included");
const b3 = createBodyPrivacyBoundary([], true);
ok(!b3.nextronAllowed("steps"), "storage OFF + stale ON → excluded");
const b4 = createBodyPrivacyBoundary(["steps","weight"], true);
ok(b4.nextronAllowed("steps") && !b4.nextronAllowed("sleep_duration"), "intersection only");

// evidence filtering
const overviewMock = {
  today: { date:"2026-09-02", activityLevel:"active", freshness:"fresh", availableMetrics:["steps","weight"] } as any,
  trends: {
    steps: { metric:"steps", currentAvg:5000, direction:"up", isSufficient:true } as any,
    weight: { metric:"weight", currentAvg:80, direction:"flat", isSufficient:true } as any,
    sleepDuration: { metric:"sleepDuration", currentAvg:400, direction:"flat", isSufficient:true } as any,
  },
  goals: [{title:"Run", status:"active"}],
  goalProgress: [{kind:"steps_average", progress01:0.5, status:"on_track", currentValue:5000, targetValue:8000, message:"on track"} as any],
  habits: [{title:"Walk"}],
  dueCount:1,
  tasks: [{title:"Task"}],
};

const ev1 = buildBodyNextronEvidence({ overview: overviewMock as any, allowedMetrics:["steps","weight"] as BodyMetricKey[], nextronAllowed:["steps"] as BodyMetricKey[], period:7});
ok(ev1.availableMetrics.length===1 && ev1.availableMetrics[0]==="steps", "only intersection included");
ok(!ev1.availableMetrics.includes("weight" as any), "unauthorized weight absent");
ok(ev1.todaySummary.availableCount===2, "todaySummary present");

const ev2 = buildBodyNextronEvidence({ overview: overviewMock as any, allowedMetrics:[], nextronAllowed:[] as any, period:7});
ok(ev2.availableMetrics.length===0, "empty permission → empty evidence");

// raw records never included: evidence has no health_records field
ok(!("health_records" in ev1) && !("records" in ev1), "no raw records");

// insufficient trend explicit
const emptyOverview = { today:null, trends:{}, goals:[], goalProgress:[], habits:[], dueCount:0, tasks:[] };
const ev3 = buildBodyNextronEvidence({ overview: emptyOverview as any, allowedMetrics:["steps"] as any, nextronAllowed:["steps"] as any, period:7});
ok(ev3.todaySummary.freshness==="empty", "insufficient explicit");

// quantitative goals
ok(getBodyGoalProgress({kind:"weight_target", targetValue:80}, 85).status==="at_risk", "weight loss at_risk");
ok(getBodyGoalProgress({kind:"weight_target", targetValue:85}, 82).status==="at_risk", "weight gain at_risk");
ok(getBodyGoalProgress({kind:"steps_average", targetValue:8000}, 8000).status==="achieved", "steps achieved");
ok(getBodyGoalProgress({kind:"sleep_duration", targetValue:450}, 400).status==="on_track", "sleep on_track");
ok(getBodyGoalProgress({kind:"exercise_frequency", targetValue:4}, null).status==="insufficient", "insufficient data");

// Today signals
const sigs = deriveBodySignals({ dueBodyHabits:[{id:"1", title:"Workout"},{id:"2", title:"Walk"}], goalProgress:[{kind:"steps_average", progress01:0.4, status:"behind", currentValue:4000, targetValue:8000, message:"behind"} as any], todaySteps:2000, stepsTarget:8000, sleepMinutes:300, sleepTargetMinutes:450});
ok(sigs.length<=3 && sigs.length>=1, "signals bounded");
ok(sigs[0].kind==="body_habit_due", "habit due priority");
const sigs2 = deriveBodySignals({ dueBodyHabits:[], goalProgress:[], todaySteps:null, stepsTarget:8000, sleepMinutes:null, sleepTargetMinutes:450});
ok(sigs2.length===0, "missing data creates no signal");

console.log(`--- Summary ${p} passed, ${f} failed ---`);
if(f) process.exit(1); else console.log("BODY NEXTRON PERMISSION — ALL PASS");
