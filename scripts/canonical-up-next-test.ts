#!/usr/bin/env tsx
// Canonical Up Next test — imports REAL domain functions, no copy
import { selectMorningPlanFirstAction, toLocalPriority, MAX_PRIORITIES_PER_DAY } from "@lifepulse/domain";
import type { TodayModel, TodayPriority, TodayTask, TodayHabit, TodayDateContext } from "@lifepulse/domain";

function localDate(d=new Date()){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function yesterdayStr(){ const d=new Date(); d.setDate(d.getDate()-1); return localDate(d); }
const TODAY = localDate();
const YESTERDAY = yesterdayStr();

function makeTask(overrides: Partial<TodayTask> & { id: string; title: string }): TodayTask {
  return {
    description: null,
    priority: "medium",
    due_date: null,
    status: "todo",
    completed_at: null,
    project_id: null,
    ...overrides,
  } as TodayTask;
}
function makeHabit(overrides: Partial<TodayHabit> & { id: string; title: string }): TodayHabit {
  return {
    description: null,
    frequency: "daily",
    days_of_week: null,
    times_per_week: null,
    ...overrides,
  } as TodayHabit;
}
function makeModel({ active, overdue, dueToday, unscheduled = [], habits = [] }: { active: TodayTask[]; overdue: TodayTask[]; dueToday: TodayTask[]; unscheduled?: TodayTask[]; habits?: TodayHabit[] }): TodayModel {
  const date: TodayDateContext = {
    localDate: TODAY,
    displayDate: TODAY,
    dayStart: `${TODAY}T00:00:00.000Z`,
    dayEnd: `${TODAY}T23:59:59.999Z`,
    dayOfWeek: new Date().getDay(),
    weekStart: TODAY,
  };
  return {
    date,
    tasks: {
      relevant: active,
      dueToday,
      overdue,
      upcoming: [],
      unscheduled,
      completedToday: [],
      active,
      totalRelevant: active.length,
      doneCount: 0,
      hasHighPriorityActive: active.some(t=>t.priority==="high"),
      contextById: {},
    },
    habits: {
      all: habits,
      dueToday: habits,
      completedToday: [],
      incompleteToday: habits,
      notDueToday: [],
      completedIds: new Set(),
      timesPerWeekCounts: {},
      weeklyProgressById: {},
      completedCount: 0,
    },
    reflection: { existingTodayEntry: null, hasReflection: false },
    context: { taskProjects: [], taskGoalLinks: [], linkedGoals: [], projectTasks: [], goalPreviewGoals: [], goalPreviewMilestones: [], goalPreviewLinks: [], goalWithoutLinks: false },
    nextActionInputs: { overdueTasks: overdue, dueTodayTasks: dueToday, incompleteHabits: habits, hasHighPriorityTasks: false, hasGoalWithoutLinks: false },
    status: { loading:false, error:null, userId:"test-user", lastLoadedLocalDate:TODAY },
    xp: { today:0, total:0 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    intendedUse: "general" as any,
  };
}

let passed=0, failed=0;
function assert(cond:boolean, msg:string){
  if(cond){ passed++; console.log(`  PASS ${msg}`); }
  else { failed++; console.error(`  FAIL ${msg}`); }
}

// Test 1: priority-linked unfinished task wins over overdue/due-today/habit
console.log("=== Canonical Up Next — priority-linked wins ===");
{
  const priorityTask = makeTask({ id:"task-prio-1", title:"Priority Task", priority:"medium", due_date:TODAY, status:"todo" });
  const overdueTask = makeTask({ id:"task-overdue-1", title:"Overdue Task", priority:"high", due_date:YESTERDAY, status:"todo" });
  const dueTodayTask = makeTask({ id:"task-due-1", title:"Due Today Task", priority:"high", due_date:TODAY, status:"todo" });
  const habit = makeHabit({ id:"habit-1", title:"Morning Run" });
  // Backend-style priority row
  const backendPriority: TodayPriority = {
    id:"prio-row-1", user_id:"test-user", local_date:TODAY, position:1, text:"Priority Task", task_id:priorityTask.id, done:false, created_at:new Date().toISOString(), updated_at:new Date().toISOString()
  };
  const lps = [backendPriority].map(toLocalPriority);
  // Verify toLocalPriority conversion
  assert(lps[0].taskId === priorityTask.id, "toLocalPriority maps task_id -> taskId");
  assert(lps[0].text === backendPriority.text, "toLocalPriority preserves text");
  assert(lps[0].done === false, "toLocalPriority preserves done");
  const model = makeModel({ active:[priorityTask, overdueTask, dueTodayTask], overdue:[overdueTask], dueToday:[priorityTask, dueTodayTask], habits:[habit] });
  const upNext = selectMorningPlanFirstAction(model, lps);
  assert(upNext !== null, "Up Next not null with priority");
  assert(upNext!.id === priorityTask.id, `priority-linked wins (got ${upNext?.id} expected ${priorityTask.id})`);
  assert(upNext!.reason === "Top priority", `reason is Top priority (got ${upNext?.reason})`);
  assert(MAX_PRIORITIES_PER_DAY===3, "MAX_PRIORITIES_PER_DAY is 3");
}

// Test 2: fallback order when no priorities — overdue wins
console.log("\n=== Fallback: overdue wins when no priority ===");
{
  const overdueTask = makeTask({ id:"task-overdue-2", title:"Overdue High", priority:"high", due_date:YESTERDAY, status:"todo" });
  const dueTodayTask = makeTask({ id:"task-due-2", title:"Due Today", priority:"high", due_date:TODAY, status:"todo" });
  const habit = makeHabit({ id:"habit-2", title:"Habit A" });
  const model = makeModel({ active:[overdueTask, dueTodayTask], overdue:[overdueTask], dueToday:[dueTodayTask], habits:[habit] });
  const upNext = selectMorningPlanFirstAction(model, []);
  assert(upNext?.id === overdueTask.id && upNext?.reason==="Overdue", "fallback overdue wins");
}

// Test 3: due-today wins when no overdue
console.log("\n=== Fallback: dueToday wins when no overdue ===");
{
  const dueTodayTask = makeTask({ id:"task-due-3", title:"Due Today Only", priority:"high", due_date:TODAY, status:"todo" });
  const habit = makeHabit({ id:"habit-3", title:"Habit B" });
  const model = makeModel({ active:[dueTodayTask], overdue:[], dueToday:[dueTodayTask], habits:[habit] });
  const upNext = selectMorningPlanFirstAction(model, []);
  assert(upNext?.id === dueTodayTask.id && upNext?.reason==="Due today", "dueToday wins");
}

// Test 4: habit wins when no tasks
console.log("\n=== Fallback: habit wins when no tasks ===");
{
  const habit = makeHabit({ id:"habit-4", title:"Daily Habit" });
  const model = makeModel({ active:[], overdue:[], dueToday:[], habits:[habit] });
  const upNext = selectMorningPlanFirstAction(model, []);
  assert(upNext?.type==="habit" && upNext?.id===habit.id, "habit wins");
}

// Test 5: done priority ignored
console.log("\n=== Priority done=true ignored ===");
{
  const priorityTask = makeTask({ id:"task-prio-done", title:"Done Priority Task", priority:"medium", due_date:TODAY, status:"todo" });
  const overdueTask = makeTask({ id:"task-overdue-done", title:"Overdue Fallback", priority:"high", due_date:YESTERDAY, status:"todo" });
  const backendPriorityDone: TodayPriority = {
    id:"prio-done", user_id:"test-user", local_date:TODAY, position:1, text:"Done Priority Task", task_id:priorityTask.id, done:true, created_at:new Date().toISOString(), updated_at:new Date().toISOString()
  };
  const lps = [backendPriorityDone].map(toLocalPriority);
  const model = makeModel({ active:[priorityTask, overdueTask], overdue:[overdueTask], dueToday:[priorityTask], habits:[] });
  const upNext = selectMorningPlanFirstAction(model, lps);
  assert(upNext?.id === overdueTask.id, "done priority ignored, overdue wins");
}

console.log(`\n--- Summary: ${passed} passed, ${failed} failed ---`);
if(failed>0) process.exit(1);
console.log("CANONICAL UP NEXT — ALL TESTS PASSED (real domain import)");
