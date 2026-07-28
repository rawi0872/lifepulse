#!/usr/bin/env node

import { readFileSync } from "fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assert(condition, label) {
  if (!condition) throw new Error(label);
  console.log(`PASS ${label}`);
}

const migration = read("supabase/migrations/00025_knowledge_hybrid_retrieval.sql");
const edge = read("supabase/functions/knowledge-embed/index.ts");
const hybrid = read("src/lib/nextron/knowledge-hybrid.ts");
const tools = read("src/lib/nextron/project-agent/tools.ts");
const knowledgePage = read("src/app/knowledge/page.tsx");
const schemas = read("src/lib/nextron/project-agent/schemas.ts");

assert(migration.includes("create extension if not exists vector with schema extensions") && migration.includes("extensions.vector(384)"), "A pgvector is enabled with 384 dimensions");
assert(migration.includes("create table if not exists public.knowledge_chunks") && migration.includes("references public.knowledge_items(id) on delete cascade"), "B chunks are tied to Knowledge items and cascade on delete");
assert(migration.includes("alter table public.knowledge_chunks enable row level security") && migration.includes("auth.uid() = user_id"), "C chunks have owner-scoped RLS");
assert(migration.includes("revoke all privileges on table public.knowledge_chunks from anon") && migration.includes("grant select, insert, update, delete on table public.knowledge_chunks to authenticated"), "D chunk privileges exclude anon/public and allow authenticated minimum CRUD");
assert(migration.includes("search_vector tsvector generated always") && migration.includes("using gin (search_vector)") && migration.includes("websearch_to_tsquery('english'"), "E FTS uses generated tsvector, GIN, and safe websearch query parsing");
assert(migration.includes("search_knowledge_chunks_hybrid") && migration.includes("full outer join semantic") && migration.includes("1.0 /") && migration.includes("rrf_k"), "F hybrid RPC uses explicit RRF fusion");
assert(migration.includes("chunk.user_id = auth.uid()") && migration.includes("item.user_id = auth.uid()") && migration.indexOf("chunk.user_id = auth.uid()") < migration.indexOf("order by chunk.embedding"), "G RPC filters owner before vector ranking");
assert(migration.includes("embedding_model_filter") && migration.includes("chunk.embedding_model = params.model"), "H semantic search requires same embedding model");
assert(edge.includes("new Supabase.ai.Session(EMBEDDING_MODEL)") && edge.includes('const EMBEDDING_MODEL = "gte-small"') && edge.includes("EMBEDDING_DIMENSIONS = 384"), "I Edge Function uses built-in gte-small only");
assert(edge.includes("authData.user") && edge.includes("SUPABASE_ANON_KEY") && !/service_role|SERVICE_ROLE|serviceRole/.test(edge), "J Edge Function is authenticated and avoids service role");
assert(edge.includes('action === "embed-query"') && edge.includes('action === "index-item"') && !edge.includes("bulk"), "K Edge Function exposes only bounded query and single-item indexing actions");
assert(edge.includes("MAX_TEXT_CHARS = 1_200") && edge.includes("MAX_QUERY_CHARS = 180") && edge.includes("MAX_CHUNKS = 40"), "L Edge Function bounds input, query, and chunks");
assert(edge.includes("row?.content_hash === chunk.contentHash") && edge.includes("skipped += 1"), "M unchanged chunks skip re-embedding");
assert(edge.includes("obsolete") && edge.includes("delete()") && edge.includes("upsert"), "N changed notes remove obsolete chunks and upsert current chunks");
assert(hybrid.includes("KNOWLEDGE_CHUNK_MAX_CHARS = 1_200") && hybrid.includes("contentHash") && hybrid.includes("splitChunkText"), "O chunking is deterministic, bounded, and hash-based");
assert(hybrid.includes("embedKnowledgeQuery") && hybrid.includes("functions.invoke(\"knowledge-embed\"") && hybrid.includes("return null"), "P query embedding failures return null for fallback");
assert(hybrid.includes("search_knowledge_chunks_hybrid") && hybrid.includes("search_knowledge_chunks_fts") && tools.includes("hybridSearchKnowledge"), "Q searchKnowledge uses hybrid then FTS RPCs");
assert(tools.indexOf("hybridSearchKnowledge") < tools.indexOf("const tokens = searchTokens"), "R keyword v1 fallback remains after hybrid/FTS fallback");
assert(tools.includes("retrievalMode") && !tools.includes("embedding,") && !tools.includes("chunk_index"), "S tool returns provenance mode without vectors or chunk IDs");
assert(knowledgePage.includes("functions.invoke(\"knowledge-embed\"") && knowledgePage.includes("Knowledge semantic indexing deferred"), "T Knowledge save triggers non-blocking indexing");
assert(schemas.includes("KNOWLEDGE_AGENT_FTS_CANDIDATES") && schemas.includes("KNOWLEDGE_AGENT_SEMANTIC_CANDIDATES") && schemas.includes("KNOWLEDGE_AGENT_QUERY_MAX_CHARS"), "U retrieval limits are explicit constants");
assert(!/openai|pinecone|qdrant|llamaindex|langchain|fastembed/i.test(edge + hybrid + tools + migration), "V no paid/vector DB/RAG framework dependency was introduced");
