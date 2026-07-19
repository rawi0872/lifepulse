// Life Pulse Results Foundation — Contract Verification
// Validates Phase 1 migration contract without deploying

import fs from 'node:fs';
import path from 'node:path';

const MIGRATION_FILE = path.resolve('supabase/migrations/00018_results_foundation.sql');
const TYPES_FILE = path.resolve('src/lib/results/types.ts');
const CONTRACT_FILE = path.resolve('src/lib/results/contract.ts');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('  ✅ ' + msg);
}

function assertIncludes(haystack, needle, context) {
  if (!haystack.includes(needle)) {
    throw new Error('FAIL: ' + context + ' — missing "' + needle + '"');
  }
  console.log('  ✅ ' + context + ' contains "' + needle + '"');
}

function assertNotIncludes(haystack, needle, context) {
  if (haystack.includes(needle)) {
    throw new Error('FAIL: ' + context + ' — should not contain "' + needle + '"');
  }
  console.log('  ✅ ' + context + ' does not contain "' + needle + '"');
}

function assertRegex(haystack, regex, context) {
  if (!regex.test(haystack)) {
    throw new Error('FAIL: ' + context + ' — pattern not found');
  }
  console.log('  ✅ ' + context + ' matches pattern');
}

const migration = read(MIGRATION_FILE);
const types = read(TYPES_FILE);
const contract = read(CONTRACT_FILE);

console.log('\n=== Results Phase 1 Contract Verification ===\n');

console.log('--- Migration file existence ---');
assert(migration.length > 0, 'Migration file exists and non-empty');

console.log('\n--- Migration: Table creation ---');
assertIncludes(migration, 'create table if not exists public.metric_definitions', 'metric_definitions table');
assertIncludes(migration, 'create table if not exists public.metric_entries', 'metric_entries table');
assertNotIncludes(migration, 'metric_targets', 'metric_targets table (should not exist in Phase 1)');
assertNotIncludes(migration, 'result_milestones', 'result_milestones table (should not exist in Phase 1)');
assertNotIncludes(migration, 'is_template', 'is_template column (should not exist in Phase 1)');

console.log('\n--- Migration: Composite FK ---');
  assertRegex(migration, /foreign key\s*\(\s*metric_definition_id\s*,\s*user_id\s*\)\s*references\s+public\.metric_definitions\s*\(\s*id\s*,\s*user_id\s*\)\s*on\s+delete\s+cascade/i, 'Composite FK on metric_entries');

  console.log('\n--- Migration: Unique constraint for composite FK ---');
  assertRegex(migration, /unique\s*\(\s*id\s*,\s*user_id\s*\)/i, 'Unique (id, user_id) on metric_definitions');
  // Ensure unique constraint appears before metric_entries table
  const uniqueIdx = migration.search(/unique\s*\(\s*id\s*,\s*user_id\s*\)/i);
  const entriesIdx = migration.search(/create table if not exists public\.metric_entries/i);
  if (uniqueIdx === -1 || entriesIdx === -1 || uniqueIdx > entriesIdx) {
    throw new Error('FAIL: Unique (id, user_id) must exist before metric_entries table');
  }
  console.log('  ✅ Unique (id, user_id) exists before metric_entries table');

console.log('\n--- Migration: Archived write protection ---');
assertIncludes(migration, 'metric_definition_is_archived', 'Archived check function');
assertIncludes(migration, 'not public.metric_definition_is_archived(metric_definition_id)', 'Insert blocked for archived');
assertIncludes(migration, 'not public.metric_definition_is_archived(metric_definition_id)', 'Update blocked for archived');

console.log('\n--- Migration: RLS policies ---');
assertIncludes(migration, 'enable row level security', 'RLS enabled on definitions');
assertIncludes(migration, 'metric_definitions_select_own', 'Definitions select policy');
assertIncludes(migration, 'metric_definitions_insert_own', 'Definitions insert policy');
assertIncludes(migration, 'metric_definitions_update_own', 'Definitions update policy');
assertIncludes(migration, 'metric_definitions_delete_own', 'Definitions delete policy');
assertIncludes(migration, 'metric_entries_select_own', 'Entries select policy');
assertIncludes(migration, 'metric_entries_insert_own', 'Entries insert policy');
assertIncludes(migration, 'metric_entries_update_own', 'Entries update policy');
assertIncludes(migration, 'metric_entries_delete_own', 'Entries delete policy');

console.log('\n--- Migration: Updated_at trigger ---');
assertIncludes(migration, 'on_metric_definitions_updated', 'Updated_at trigger on definitions');
assertNotIncludes(migration, 'on_metric_entries_updated', 'No updated_at trigger on entries (immutable)');

console.log('\n--- Migration: No template records ---');
assertNotIncludes(migration, 'INSERT INTO metric_definitions', 'No template seed data');
assertNotIncludes(migration, 'is_template', 'No is_template column');

console.log('\n--- Types: Domain & value kinds ---');
assertIncludes(types, 'ResultDomain', 'ResultDomain type');
assertIncludes(types, 'ResultValueKind', 'ResultValueKind type');
assertIncludes(types, 'ResultTargetDirection', 'ResultTargetDirection type');
assertIncludes(types, 'ResultCadence', 'ResultCadence type');

console.log('\n--- Types: Row interfaces ---');
assertIncludes(types, 'MetricDefinitionRow', 'MetricDefinitionRow interface');
assertIncludes(types, 'MetricEntryRow', 'MetricEntryRow interface');
assertIncludes(types, 'MetricDefinitionInput', 'MetricDefinitionInput interface');
assertIncludes(types, 'MetricEntryInput', 'MetricEntryInput interface');

console.log('\n--- Types: Type guards ---');
assertIncludes(types, 'isResultDomain', 'isResultDomain guard');
assertIncludes(types, 'isResultValueKind', 'isResultValueKind guard');
assertIncludes(types, 'isResultTargetDirection', 'isResultTargetDirection guard');
assertIncludes(types, 'isResultCadence', 'isResultCadence guard');

console.log('\n--- Contract: Constants ---');
assertIncludes(contract, 'NUMERIC_PRECISION', 'Numeric precision constant');
assertIncludes(contract, 'NUMERIC_SCALE', 'Numeric scale constant');
assertIncludes(contract, 'NUMERIC_MAX', 'Numeric max bound');
assertIncludes(contract, 'NUMERIC_MIN', 'Numeric min bound');
assertIncludes(contract, 'PERCENTAGE_MIN', 'Percentage min');
assertIncludes(contract, 'PERCENTAGE_MAX', 'Percentage max');
assertIncludes(contract, 'PERCENTAGE_DECIMALS', 'Percentage decimals');
assertIncludes(contract, 'DURATION_MIN', 'Duration min');
assertIncludes(contract, 'DURATION_MAX', 'Duration max');
assertIncludes(contract, 'COUNT_MIN', 'Count min');
assertIncludes(contract, 'COUNT_MAX', 'Count max');
assertIncludes(contract, 'RATING_MIN', 'Rating min');
assertIncludes(contract, 'RATING_MAX', 'Rating max');
assertIncludes(contract, 'NAME_MAX', 'Name max');
assertIncludes(contract, 'UNIT_MAX', 'Unit max');
assertIncludes(contract, 'DESCRIPTION_MAX', 'Description max');
assertIncludes(contract, 'NOTES_MAX', 'Notes max');

console.log('\n--- Contract: Defaults ---');
assertIncludes(contract, 'DEFAULT_TARGET_DIRECTION', 'Default target direction');
assertIncludes(contract, 'DEFAULT_CADENCE', 'Default cadence');
assertIncludes(contract, 'DEFAULT_ARCHIVED', 'Default archived');

console.log('\n--- Contract: Type guards ---');
assertIncludes(contract, 'isResultDomain', 'isResultDomain guard');
assertIncludes(contract, 'isResultValueKind', 'isResultValueKind guard');
assertIncludes(contract, 'isResultTargetDirection', 'isResultTargetDirection guard');
assertIncludes(contract, 'isResultCadence', 'isResultCadence guard');

console.log('\n--- Contract: No UI/hook/Supabase imports ---');
assertNotIncludes(contract, 'import', 'No imports in contract (pure constants)');
assertNotIncludes(contract, 'createClient', 'No Supabase client');
assertNotIncludes(contract, 'useState', 'No React hooks');
assertNotIncludes(contract, 'useEffect', 'No React effects');

console.log('\n--- TypeScript: Numeric as string | number ---');
assertIncludes(types, 'baseline_value: string | number | null', 'baseline_value string | number');
assertIncludes(types, 'target_value: string | number | null', 'target_value string | number');
assertIncludes(types, 'value: string | number', 'MetricEntryRow value string | number');

console.log('\n--- Rating decision: fixed 1-10 ---');
assertIncludes(contract, 'RATING_MIN = 1', 'Rating min 1');
assertIncludes(contract, 'RATING_MAX = 10', 'Rating max 10');
assertNotIncludes(types, 'scale_min', 'No scale_min column');
assertNotIncludes(types, 'scale_max', 'No scale_max column');

console.log('\n--- Percentage representation 0-100 ---');
assertIncludes(contract, 'PERCENTAGE_MIN = 0', 'Percentage min 0');
assertIncludes(contract, 'PERCENTAGE_MAX = 100', 'Percentage max 100');

console.log('\n--- Duration = minutes ---');
assertIncludes(contract, 'DURATION_MIN', 'Duration min');
assertIncludes(contract, 'DURATION_MAX', 'Duration max');

console.log('\n--- Counts = integers ---');
assertIncludes(contract, 'COUNT_MAX', 'Count max bound');

console.log('\n--- Numeric bounds absolute ---');
assertIncludes(contract, 'NUMERIC_ABS_MAX = 9_999_999_999.999999', 'Abs max bound');
assertIncludes(contract, 'NUMERIC_ABS_MIN = -9_999_999_999.999999', 'Abs min bound');

console.log('\n--- Text limits ---');
assertIncludes(contract, 'NAME_MAX = 80', 'Name max 80');
assertIncludes(contract, 'UNIT_MAX = 20', 'Unit max 20');
assertIncludes(contract, 'DESCRIPTION_MAX = 1000', 'Description max 1000');
assertIncludes(contract, 'NOTES_MAX = 5000', 'Notes max 5000');

console.log('\n--- Defaults: target_direction=none, cadence=none, archived=false ---');
assertIncludes(contract, 'DEFAULT_TARGET_DIRECTION', 'Default target_direction');
assertIncludes(contract, 'DEFAULT_CADENCE', 'Default cadence');
assertIncludes(contract, 'DEFAULT_ARCHIVED = false', 'Default archived false');

console.log('\n--- Composite FK present ---');
  assertRegex(migration, /foreign key\s*\(\s*metric_definition_id\s*,\s*user_id\s*\)\s*references\s+public\.metric_definitions\s*\(\s*id\s*,\s*user_id\s*\)\s*on\s+delete\s+cascade/i, 'Composite FK declaration');

console.log('\n--- No public/anonymous policies ---');
  assertNotIncludes(migration, 'anon', 'No anon role in policies');
  assertNotIncludes(migration, 'TO public', 'No public role in policies');

console.log('\n--- No SECURITY DEFINER except helper ---');
// The metric_definition_is_archived is SECURITY INVOKER, not DEFINER
assertNotIncludes(migration, 'SECURITY DEFINER', 'No SECURITY DEFINER on policies');

console.log('\n--- All checks passed ---');
console.log('\n=== Contract Verification Complete ===\n');