import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import {
  KNOWLEDGE_AGENT_FTS_CANDIDATES,
  KNOWLEDGE_AGENT_MAX_SNIPPET_CHARS,
  KNOWLEDGE_AGENT_MAX_TOTAL_CONTEXT_CHARS,
  KNOWLEDGE_AGENT_QUERY_MAX_CHARS,
  KNOWLEDGE_AGENT_SEMANTIC_CANDIDATES,
  KNOWLEDGE_AGENT_TOP_K,
} from "@/lib/nextron/project-agent/schemas";

export const KNOWLEDGE_EMBEDDING_MODEL = "gte-small";
export const KNOWLEDGE_EMBEDDING_DIMENSIONS = 384;
export const KNOWLEDGE_CHUNK_MAX_CHARS = 1_200;
export const KNOWLEDGE_CHUNK_OVERLAP_CHARS = 120;

export interface KnowledgeChunkInput {
  chunkIndex: number;
  section: string | null;
  content: string;
  contentHash: string;
}

export interface KnowledgeSearchResult {
  title: string;
  type: string;
  category: string | null;
  updatedDate: string | null;
  section: string | null;
  source: string;
  snippet: string;
  retrieval: "hybrid" | "semantic" | "fts" | "keyword";
}

interface HybridRpcRow {
  title: string | null;
  type: string | null;
  category: string | null;
  section: string | null;
  content: string | null;
  source_url: string | null;
  updated_at: string | null;
  retrieval_source: string | null;
}

export function sanitizeKnowledgeText(value: string | null | undefined, max = 3_000): string {
  return (value ?? "")
    .replace(/<!--[^>]*-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[{}<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function contentHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function buildKnowledgeChunks(input: { title?: string | null; summary?: string | null; content?: string | null }): KnowledgeChunkInput[] {
  const title = sanitizeKnowledgeText(input.title, 140);
  const sections: Array<{ section: string | null; text: string }> = [];
  const summary = sanitizeKnowledgeText(input.summary, 1_200);
  if (summary) sections.push({ section: "Summary", text: summary });

  const rawContent = (input.content ?? "").replace(/\r\n/g, "\n");
  let currentSection: string | null = null;
  let buffer: string[] = [];
  function flush() {
    const text = sanitizeKnowledgeText(buffer.join("\n\n"), 20_000);
    if (text) sections.push({ section: currentSection, text });
    buffer = [];
  }
  for (const block of rawContent.split(/\n{2,}/)) {
    const trimmed = block.trim();
    const heading = trimmed.match(/^#{1,4}\s+(.{1,100})$/);
    if (heading) {
      flush();
      currentSection = sanitizeKnowledgeText(heading[1], 100) || null;
      continue;
    }
    if (trimmed) buffer.push(trimmed);
  }
  flush();

  const chunks: KnowledgeChunkInput[] = [];
  let index = 0;
  for (const section of sections) {
    const base = [title ? `Title: ${title}` : null, section.section ? `Section: ${section.section}` : null, section.text].filter(Boolean).join("\n");
    for (const content of splitChunkText(base)) {
      chunks.push({ chunkIndex: index, section: section.section, content, contentHash: contentHash(`${KNOWLEDGE_EMBEDDING_MODEL}\n${content}`) });
      index += 1;
    }
  }
  return chunks.slice(0, 40);
}

function splitChunkText(text: string): string[] {
  if (text.length <= KNOWLEDGE_CHUNK_MAX_CHARS) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length && chunks.length < 40) {
    const hardEnd = Math.min(text.length, start + KNOWLEDGE_CHUNK_MAX_CHARS);
    const window = text.slice(start, hardEnd);
    const softBreak = Math.max(window.lastIndexOf(". "), window.lastIndexOf("\n"), window.lastIndexOf("; "));
    const end = softBreak > 500 && hardEnd < text.length ? start + softBreak + 1 : hardEnd;
    const chunk = sanitizeKnowledgeText(text.slice(start, end), KNOWLEDGE_CHUNK_MAX_CHARS);
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;
    start = Math.max(0, end - KNOWLEDGE_CHUNK_OVERLAP_CHARS);
  }
  return chunks;
}

export function searchTokens(value: string): string[] {
  const stop = new Set(["about", "after", "again", "what", "when", "where", "which", "with", "from", "that", "this", "note", "notes", "write", "wrote", "knowledge", "decide", "decided", "decision"]);
  return Array.from(new Set(value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])).filter((token) => !stop.has(token)).slice(0, 8);
}

export function vectorToSqlText(vector: number[]): string | null {
  if (vector.length !== KNOWLEDGE_EMBEDDING_DIMENSIONS || vector.some((value) => !Number.isFinite(value))) return null;
  return `[${vector.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

export async function embedKnowledgeQuery(supabase: SupabaseClient, query: string): Promise<number[] | null> {
  const bounded = sanitizeKnowledgeText(query, KNOWLEDGE_AGENT_QUERY_MAX_CHARS);
  if (!bounded) return null;
  const { data, error } = await supabase.functions.invoke("knowledge-embed", { body: { action: "embed-query", text: bounded } });
  if (error) return null;
  const embedding = (data as { embedding?: unknown })?.embedding;
  if (!Array.isArray(embedding) || embedding.length !== KNOWLEDGE_EMBEDDING_DIMENSIONS) return null;
  return embedding.every((value) => typeof value === "number" && Number.isFinite(value)) ? embedding : null;
}

export async function hybridSearchKnowledge(supabase: SupabaseClient, query: string): Promise<{ results: KnowledgeSearchResult[]; mode: "hybrid" | "fts" | "keyword" }> {
  const boundedQuery = sanitizeKnowledgeText(query, KNOWLEDGE_AGENT_QUERY_MAX_CHARS);
  if (!boundedQuery) return { results: [], mode: "keyword" };
  const embedding = await embedKnowledgeQuery(supabase, boundedQuery);
  if (embedding) {
    const embeddingText = vectorToSqlText(embedding);
    if (embeddingText) {
      const { data, error } = await supabase.rpc("search_knowledge_chunks_hybrid", {
        query_text: boundedQuery,
        query_embedding_text: embeddingText,
        match_count: KNOWLEDGE_AGENT_TOP_K,
        fts_candidate_count: KNOWLEDGE_AGENT_FTS_CANDIDATES,
        semantic_candidate_count: KNOWLEDGE_AGENT_SEMANTIC_CANDIDATES,
        embedding_model_filter: KNOWLEDGE_EMBEDDING_MODEL,
      });
      if (!error) {
        const results = formatHybridRows((data ?? []) as HybridRpcRow[]);
        if (results.length > 0) return { results, mode: "hybrid" };
      }
    }
  }

  const { data, error } = await supabase.rpc("search_knowledge_chunks_fts", {
    query_text: boundedQuery,
    match_count: KNOWLEDGE_AGENT_TOP_K,
    candidate_count: KNOWLEDGE_AGENT_FTS_CANDIDATES,
  });
  if (!error) {
    const results = formatHybridRows((data ?? []) as HybridRpcRow[]);
    if (results.length > 0) return { results, mode: "fts" };
  }
  return { results: [], mode: "keyword" };
}

function formatHybridRows(rows: HybridRpcRow[]): KnowledgeSearchResult[] {
  let totalChars = 0;
  return rows.slice(0, KNOWLEDGE_AGENT_TOP_K).map((row) => {
    const title = sanitizeKnowledgeText(row.title, 90) || "Untitled Knowledge note";
    const date = row.updated_at?.slice(0, 10) ?? null;
    const remaining = Math.max(0, KNOWLEDGE_AGENT_MAX_TOTAL_CONTEXT_CHARS - totalChars);
    const snippet = sanitizeKnowledgeText(row.content, Math.min(KNOWLEDGE_AGENT_MAX_SNIPPET_CHARS, remaining));
    totalChars += snippet.length;
    const retrieval: KnowledgeSearchResult["retrieval"] = row.retrieval_source === "semantic" || row.retrieval_source === "hybrid" || row.retrieval_source === "fts" ? row.retrieval_source : "fts";
    return {
      title,
      type: sanitizeKnowledgeText(row.type, 24) || "note",
      category: sanitizeKnowledgeText(row.category, 48) || null,
      updatedDate: date,
      section: sanitizeKnowledgeText(row.section, 80) || null,
      source: date ? `${title} — ${date}` : title,
      snippet,
      retrieval,
    };
  }).filter((item) => item.snippet.length > 0);
}
