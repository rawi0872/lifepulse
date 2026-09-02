import { buildDailyHealthAggregateDedupeKey, isValidHealthNumericValue } from "../packages/domain/health";
let p=0,f=0; const ok=(c:boolean,l:string)=>{ if(c){p++; console.log(`  PASS ${l}`);} else {f++; console.log(`  FAIL ${l}`);} };
ok(buildDailyHealthAggregateDedupeKey("sleep_duration","2026-09-02")==="sleep_duration:daily:2026-09-02","sleep dedupe");
ok(buildDailyHealthAggregateDedupeKey("weight","2026-09-02")==="weight:daily:2026-09-02","weight dedupe");
ok(buildDailyHealthAggregateDedupeKey("resting_heart_rate","2026-09-02")!==buildDailyHealthAggregateDedupeKey("resting_heart_rate","2026-09-03"),"cross-day dedupe diff");
ok(!isValidHealthNumericValue("resting_heart_rate",500),"rhr 500 invalid");
ok(isValidHealthNumericValue("resting_heart_rate",70),"rhr 70 valid");
ok(!isValidHealthNumericValue("weight",501),"weight 501 invalid");
ok(isValidHealthNumericValue("steps",0),"steps 0 valid per bounds");
// overlapping sleep handling: dedupe same-day stable
const k1=buildDailyHealthAggregateDedupeKey("sleep_duration","2026-09-02");
const k2=buildDailyHealthAggregateDedupeKey("sleep_duration","2026-09-02");
ok(k1===k2,"sleep idempotent");
console.log(`--- Summary ${p} passed, ${f} failed ---`);
if(f) process.exit(1);
