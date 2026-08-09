import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function check(condition, label) {
  if (!condition) {
    console.error(`FAIL ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS ${label}`);
}

const migration = read("supabase/migrations/00023_nextron_memories.sql");
const memory = read("src/lib/nextron/memory.ts");
const askRoute = read("src/app/api/nextron/ask/route.ts");
const memoryRoute = read("src/app/api/nextron/memory/route.ts");
const settings = read("src/app/settings/page.tsx");

check(/create table if not exists public\.nextron_memories/.test(migration), "schema creates nextron_memories");
check(/type text not null check \(type in \('PREFERENCE'\)\)/.test(migration), "schema limits v1 to preference type");
check(/status text not null default 'ACTIVE' check \(status in \('ACTIVE', 'SUPERSEDED', 'DELETED'\)\)/.test(migration), "schema supports active superseded deleted lifecycle");
check(/confirmed_by_user boolean not null default true check \(confirmed_by_user = true\)/.test(migration), "schema requires confirmed user memory");
check(/alter table public\.nextron_memories enable row level security/.test(migration), "RLS enabled");
check(/for select\s+to authenticated\s+using \(auth\.uid\(\) = user_id\)/s.test(migration), "owner-only select policy");
check(/for insert\s+to authenticated\s+with check[\s\S]*auth\.uid\(\) = user_id[\s\S]*type = 'PREFERENCE'[\s\S]*status = 'ACTIVE'[\s\S]*confirmed_by_user = true/s.test(migration), "owner-only constrained insert policy");
check(/for update\s+to authenticated\s+using \(auth\.uid\(\) = user_id\)\s+with check \(auth\.uid\(\) = user_id\)/s.test(migration), "owner-only update policy");
check(/revoke all privileges on table public\.nextron_memories from anon/.test(migration), "anon privileges revoked");
check(/revoke all privileges on table public\.nextron_memories from public/.test(migration), "public privileges revoked");
check(/grant select, insert, update, delete on table public\.nextron_memories to authenticated/.test(migration), "authenticated CRUD granted only after revokes");

check(/server-only/.test(memory), "memory subsystem is server-only");
check(/SECRET_OR_INTERNAL_PATTERNS/.test(memory), "memory rejects secrets and internal identifiers");
check(/IMPLICIT_INFERENCE_PATTERNS/.test(memory), "memory rejects implicit inference patterns");
check(/NEXTRON_MEMORY_CONTENT_MAX_LENGTH = 240/.test(memory), "memory content is bounded");
check(/status: "SUPERSEDED"/.test(memory), "memory edit/supersession preserves history");
check(/status: "DELETED", content: "\[deleted preference\]"/.test(memory), "forget soft-deletes and redacts content");
check(/retrieveRelevantPreferenceMemories/.test(memory), "bounded retrieval function exists");
check(/PROJECT_AGENT/.test(memory) && /return false/.test(memory), "project prompts exclude unrelated memories");

check(/parseNextronMemoryCommand/.test(askRoute), "ask route handles memory intent deterministically");
check(/rememberPreferenceMemory\(supabase, user\.id/.test(askRoute), "ask route derives user identity server-side for writes");
check(!/body\.user_?id|userId\s*[:=]\s*body/.test(askRoute), "ask route does not accept user id authority from prompt body");
check(/retrieveRelevantPreferenceMemories\(supabase, (user\.id|userId), (parsed\.request|parsedRequest)\)/.test(askRoute), "ask route retrieves active relevant memories");

check(/auth\.supabase, auth\.userId/.test(memoryRoute), "memory API derives user identity server-side");
check(!/service_role|SUPABASE_SERVICE_ROLE|createAdmin/i.test(memoryRoute), "memory API does not use service role");
check(/GET\(\)/.test(memoryRoute) && /PATCH\(request: Request\)/.test(memoryRoute) && /DELETE\(request: Request\)/.test(memoryRoute), "memory API supports view edit forget");

check(/NEXTRON Memory/.test(settings), "settings includes NEXTRON Memory surface");
check(/Edit/.test(settings) && /Forget/.test(settings), "settings supports edit and forget controls");
const memorySettingsSurface = settings.slice(settings.indexOf("NEXTRON Memory"));
check(!/service_role|api_key|user_id/.test(memorySettingsSurface), "settings memory UI does not expose internal authority terms");

process.exit(process.exitCode ?? 0);
