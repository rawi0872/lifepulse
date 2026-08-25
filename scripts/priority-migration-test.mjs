/**
 * Deterministic tests for priority migration (Phase 2E-A)
 * Covers 5 required scenarios A-E plus helper invariants.
 * Run: node scripts/priority-migration-test.mjs
 */

// --- Helpers under test (JS copies of src/lib/priority-migration.ts logic) ---

function readLegacyPriorities(storage, localDate) {
  try {
    const saved = storage.getItem("lifepulse_priorities");
    if (saved) {
      const data = JSON.parse(saved);
      if (data.date === localDate && Array.isArray(data.items)) {
        return data.items.slice(0, 3);
      }
    }
    const oldFocus = storage.getItem("lifepulse_focus");
    if (oldFocus) {
      const { text, date } = JSON.parse(oldFocus);
      if (date === localDate && text) {
        return [{ text, done: false }];
      }
    }
  } catch {}
  return [];
}

function clearLegacyPriorities(storage, localDate) {
  try {
    const saved = storage.getItem("lifepulse_priorities");
    if (saved) {
      const data = JSON.parse(saved);
      if (data.date === localDate) storage.removeItem("lifepulse_priorities");
    }
    const oldFocus = storage.getItem("lifepulse_focus");
    if (oldFocus) {
      const { date } = JSON.parse(oldFocus);
      if (date === localDate) storage.removeItem("lifepulse_focus");
    }
  } catch {}
}

// Mock Storage
class MockStorage {
  constructor(initial = {}) { this.map = new Map(Object.entries(initial)); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, v); }
  removeItem(k) { this.map.delete(k); }
  has(k) { return this.map.has(k); }
}

// Mock Supabase-like backend for priorities
function createMockBackend({ initialRows = [], failLoad = false, failSave = false } = {}) {
  let rows = [...initialRows]; // { id, user_id, local_date, position, text, task_id, done }
  let loadCalls = 0, saveCalls = 0;
  return {
    get rows() { return rows; },
    get loadCalls() { return loadCalls; },
    get saveCalls() { return saveCalls; },
    async load(userId, localDate) {
      loadCalls++;
      if (failLoad) return { data: [], error: new Error("network") };
      const data = rows.filter(r => r.user_id === userId && r.local_date === localDate).sort((a,b)=>a.position-b.position).slice(0,3);
      return { data, error: null };
    },
    async save(userId, localDate, items) {
      saveCalls++;
      if (failSave) return false;
      // delete existing for that day
      rows = rows.filter(r => !(r.user_id === userId && r.local_date === localDate));
      items.slice(0,3).forEach((item, idx) => {
        rows.push({ id: `id-${idx}-${Date.now()}`, user_id: userId, local_date: localDate, position: idx+1, text: item.text.trim(), task_id: item.taskId ?? null, done: item.done ?? false });
      });
      return true;
    }
  };
}

// executePriorityMigration JS copy (same as TS version)
async function executePriorityMigration({ backend, userId, localDate, storage }) {
  const loaded = await backend.load(userId, localDate);
  if (loaded.error) {
    return { priorities: [], localStorageCleared: false, uploadAttempted: false, uploadSucceeded: false };
  }
  if (loaded.data.length > 0) {
    clearLegacyPriorities(storage, localDate);
    return { priorities: loaded.data, localStorageCleared: true, uploadAttempted: false, uploadSucceeded: false };
  }
  const legacy = readLegacyPriorities(storage, localDate);
  if (legacy.length === 0) {
    return { priorities: [], localStorageCleared: false, uploadAttempted: false, uploadSucceeded: false };
  }
  const ok = await backend.save(userId, localDate, legacy);
  if (ok) {
    clearLegacyPriorities(storage, localDate);
    const reloaded = await backend.load(userId, localDate);
    if (reloaded.error) return { priorities: [], localStorageCleared: true, uploadAttempted: true, uploadSucceeded: true };
    return { priorities: reloaded.data, localStorageCleared: true, uploadAttempted: true, uploadSucceeded: true };
  }
  return { priorities: [], localStorageCleared: false, uploadAttempted: true, uploadSucceeded: false };
}

// --- Test harness ---
let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  PASS: ${msg}`); }
  else { failed++; console.error(`  FAIL: ${msg}`); }
}
function section(name) { console.log(`\n=== ${name} ===`); }

// Today helpers
const TODAY = "2026-08-25";
const YESTERDAY = "2026-08-24";

async function run() {
  // Helper invariants
  section("Helper: read is non-destructive");
  {
    const s = new MockStorage({ lifepulse_priorities: JSON.stringify({ date: TODAY, items: [{ text: "a", done: false }] }) });
    const first = readLegacyPriorities(s, TODAY);
    const second = readLegacyPriorities(s, TODAY);
    assert(first.length === 1 && second.length === 1, "read does not delete");
    assert(s.has("lifepulse_priorities"), "storage still has key after read");
    clearLegacyPriorities(s, TODAY);
    assert(!s.has("lifepulse_priorities"), "clear removes after success");
  }

  section("Helper: stale not returned");
  {
    const s = new MockStorage({ lifepulse_priorities: JSON.stringify({ date: YESTERDAY, items: [{ text: "stale", done: false }] }) });
    const r = readLegacyPriorities(s, TODAY);
    assert(r.length === 0, "stale previous-day not returned");
  }

  // Scenario A: backend has data, localStorage same-day -> backend wins, no overwrite
  section("Scenario A: backend non-empty + localStorage same-day => backend wins");
  {
    const backend = createMockBackend({ initialRows: [
      { id: "m1", user_id: "u1", local_date: TODAY, position: 1, text: "mobile priority 1", task_id: null, done: false },
      { id: "m2", user_id: "u1", local_date: TODAY, position: 2, text: "mobile priority 2", task_id: null, done: false },
    ]});
    const storage = new MockStorage({ lifepulse_priorities: JSON.stringify({ date: TODAY, items: [{ text: "web stale", done: false }] }) });
    const res = await executePriorityMigration({ backend, userId: "u1", localDate: TODAY, storage });
    assert(res.priorities.length === 2 && res.priorities[0].text === "mobile priority 1", "backend priorities returned");
    assert(res.uploadAttempted === false, "no upload attempted");
    assert(backend.saveCalls === 0, "backend not overwritten");
    assert(!storage.has("lifepulse_priorities"), "legacy cleared so it cannot overwrite later");
    assert(res.localStorageCleared === true, "localStorageCleared true");
  }

  // Scenario A also with stale localStorage -> backend still wins
  section("Scenario A (stale local): backend non-empty + stale local => backend wins, no upload");
  {
    const backend = createMockBackend({ initialRows: [
      { id: "m1", user_id: "u1", local_date: TODAY, position: 1, text: "mobile", task_id: null, done: false },
    ]});
    const storage = new MockStorage({ lifepulse_priorities: JSON.stringify({ date: YESTERDAY, items: [{ text: "old", done: false }] }) });
    const res = await executePriorityMigration({ backend, userId: "u1", localDate: TODAY, storage });
    assert(res.priorities.length === 1, "backend still returned");
    assert(backend.saveCalls === 0, "no save");
  }

  // Scenario B: backend empty + valid same-day -> upload, cleared only after success
  section("Scenario B: backend empty + valid same-day => upload and clear after success");
  {
    const backend = createMockBackend({ initialRows: [] });
    const storage = new MockStorage({ lifepulse_priorities: JSON.stringify({ date: TODAY, items: [{ text: "web priority", done: false }, { text: "second", done: true }] }) });
    // verify read does not clear before upload
    const pre = readLegacyPriorities(storage, TODAY);
    assert(pre.length === 2 && storage.has("lifepulse_priorities"), "before upload, storage not cleared and read is non-destructive");
    const res = await executePriorityMigration({ backend, userId: "u1", localDate: TODAY, storage });
    assert(res.uploadAttempted === true && res.uploadSucceeded === true, "upload succeeded");
    assert(res.priorities.length === 2, "reloaded priorities from backend");
    assert(!storage.has("lifepulse_priorities"), "legacy cleared only after success");
    assert(backend.rows.length === 2, "backend now has 2 rows");
    assert(res.localStorageCleared === true, "localStorageCleared true");
  }

  // Scenario C: backend empty + stale -> nothing uploaded
  section("Scenario C: backend empty + stale previous-day => nothing uploaded");
  {
    const backend = createMockBackend({ initialRows: [] });
    const storage = new MockStorage({ lifepulse_priorities: JSON.stringify({ date: YESTERDAY, items: [{ text: "stale", done: false }] }) });
    const res = await executePriorityMigration({ backend, userId: "u1", localDate: TODAY, storage });
    assert(res.uploadAttempted === false, "no upload for stale");
    assert(res.priorities.length === 0, "no priorities");
    assert(backend.saveCalls === 0, "no save call");
  }

  // Scenario D: backend empty + valid same-day + upload fails -> preserve localStorage
  section("Scenario D: backend empty + valid same-day + upload fails => preserve localStorage");
  {
    const backend = createMockBackend({ initialRows: [], failSave: true });
    const storage = new MockStorage({ lifepulse_priorities: JSON.stringify({ date: TODAY, items: [{ text: "important", done: false }] }) });
    const res = await executePriorityMigration({ backend, userId: "u1", localDate: TODAY, storage });
    assert(res.uploadAttempted === true && res.uploadSucceeded === false, "upload attempted and failed");
    assert(res.localStorageCleared === false, "not cleared on failure");
    assert(storage.has("lifepulse_priorities"), "localStorage preserved for retry");
    assert(backend.rows.length === 0, "backend still empty");
  }

  // Scenario E: backend load fails -> do not overwrite, do not clear
  section("Scenario E: backend load fails => do not overwrite, do not clear");
  {
    const backend = createMockBackend({ initialRows: [{ id: "m1", user_id: "u1", local_date: TODAY, position: 1, text: "existing", task_id: null, done: false }], failLoad: true });
    const storage = new MockStorage({ lifepulse_priorities: JSON.stringify({ date: TODAY, items: [{ text: "local", done: false }] }) });
    const res = await executePriorityMigration({ backend, userId: "u1", localDate: TODAY, storage });
    assert(res.uploadAttempted === false, "no upload when load fails");
    assert(res.localStorageCleared === false, "not cleared on load failure");
    assert(storage.has("lifepulse_priorities"), "localStorage preserved");
    assert(backend.saveCalls === 0, "no save when load fails");
  }

  // Scenario E without legacy
  section("Scenario E (no legacy): backend load fails with no legacy => safe empty");
  {
    const backend = createMockBackend({ failLoad: true });
    const storage = new MockStorage({});
    const res = await executePriorityMigration({ backend, userId: "u1", localDate: TODAY, storage });
    assert(res.priorities.length === 0, "empty when load fails and no legacy");
    assert(res.localStorageCleared === false, "not cleared");
  }

  console.log(`\n--- Summary: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
  else console.log("All priority migration scenarios PASSED");
}

run().catch(e => { console.error(e); process.exit(1); });
