import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const EMBEDDING_MODEL = "gte-small";
const EMBEDDING_DIMENSIONS = 384;
const MAX_TEXT_CHARS = 1_200;
const MAX_QUERY_CHARS = 180;
const MAX_CHUNKS = 40;

type KnowledgeItem = { id: string; user_id: string; title: string | null; summary: string | null; content: string | null; status: string | null };
type ExistingChunk = { chunk_index: number; content_hash: string; embedding_model: string };
type Chunk = { chunkIndex: number; section: string | null; content: string; contentHash: string };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const model = new Supabase.ai.Session(EMBEDDING_MODEL);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "not_authenticated" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return json({ error: "function_not_configured" }, 500);

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return json({ error: "not_authenticated" }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const action = typeof (body as { action?: unknown }).action === "string" ? (body as { action: string }).action : "";
  try {
    if (action === "embed-query") {
      const text = sanitize((body as { text?: unknown }).text, MAX_QUERY_CHARS);
      if (!text) return json({ error: "empty_text" }, 400);
      const embedding = await embed(text);
      return json({ embedding, model: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMENSIONS });
    }

    if (action === "index-item") {
      const itemId = typeof (body as { itemId?: unknown }).itemId === "string" ? (body as { itemId: string }).itemId : "";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(itemId)) return json({ error: "invalid_item" }, 400);
      const result = await indexItem(supabase, authData.user.id, itemId);
      return json(result);
    }

    return json({ error: "unknown_action" }, 400);
  } catch {
    return json({ error: "embedding_unavailable" }, 503);
  }
});

async function indexItem(supabase: ReturnType<typeof createClient>, userId: string, itemId: string) {
  const { data: item, error: itemError } = await supabase
    .from("knowledge_items")
    .select("id, user_id, title, summary, content, status")
    .eq("id", itemId)
    .eq("user_id", userId)
    .maybeSingle();
  if (itemError) throw itemError;

  if (!item || (item as KnowledgeItem).status !== "active") {
    await supabase.from("knowledge_chunks").delete().eq("knowledge_item_id", itemId).eq("user_id", userId);
    return { indexed: 0, skipped: 0, deleted: true, model: EMBEDDING_MODEL };
  }

  const knowledgeItem = item as KnowledgeItem;
  const chunks = buildChunks(knowledgeItem).slice(0, MAX_CHUNKS);
  const { data: existingRows, error: existingError } = await supabase
    .from("knowledge_chunks")
    .select("chunk_index, content_hash, embedding_model")
    .eq("knowledge_item_id", itemId)
    .eq("user_id", userId);
  if (existingError) throw existingError;

  const existingList = (existingRows ?? []) as ExistingChunk[];
  const existing = new Map(existingList.map((row) => [row.chunk_index, row]));
  const validIndexes = new Set(chunks.map((chunk) => chunk.chunkIndex));
  const obsolete = [...existing.keys()].filter((index) => !validIndexes.has(index));
  if (obsolete.length > 0) {
    const { error } = await supabase.from("knowledge_chunks").delete().eq("knowledge_item_id", itemId).eq("user_id", userId).in("chunk_index", obsolete);
    if (error) throw error;
  }

  let indexed = 0;
  let skipped = 0;
  for (const chunk of chunks) {
    const row = existing.get(chunk.chunkIndex);
    if (row?.content_hash === chunk.contentHash && row.embedding_model === EMBEDDING_MODEL) {
      skipped += 1;
      continue;
    }
    const embedding = await embed(chunk.content);
    const { error } = await supabase.from("knowledge_chunks").upsert({
      user_id: userId,
      knowledge_item_id: itemId,
      chunk_index: chunk.chunkIndex,
      section: chunk.section,
      content: chunk.content,
      content_hash: chunk.contentHash,
      embedding_model: EMBEDDING_MODEL,
      embedding,
    }, { onConflict: "knowledge_item_id,chunk_index" });
    if (error) throw error;
    indexed += 1;
  }
  return { indexed, skipped, deleted: false, model: EMBEDDING_MODEL };
}

async function embed(text: string): Promise<number[]> {
  const output = await model.run(text.slice(0, MAX_TEXT_CHARS), { mean_pool: true, normalize: true });
  const embedding = Array.isArray(output) ? output : Array.from(output as ArrayLike<number>);
  if (embedding.length !== EMBEDDING_DIMENSIONS || embedding.some((value) => typeof value !== "number" || !Number.isFinite(value))) throw new Error("bad_embedding");
  return embedding;
}

function buildChunks(item: KnowledgeItem): Chunk[] {
  const title = sanitize(item.title, 140);
  const sections: Array<{ section: string | null; text: string }> = [];

  let currentSection: string | null = null;
  let buffer: string[] = [];
  const flush = () => {
    const text = sanitize(buffer.join("\n\n"), 20_000);
    if (text) sections.push({ section: currentSection, text });
    buffer = [];
  };
  for (const block of (item.content ?? "").replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const trimmed = block.trim();
    const heading = trimmed.match(/^#{1,4}\s+(.{1,100})$/);
    if (heading) {
      flush();
      currentSection = sanitize(heading[1], 100) || null;
      continue;
    }
    if (trimmed) buffer.push(trimmed);
  }
  flush();

  const summary = sanitize(item.summary, 1_200);
  if (summary) sections.push({ section: "Summary", text: summary });

  const chunks: Chunk[] = [];
  let index = 0;
  for (const section of sections) {
    const base = [title ? `Title: ${title}` : null, section.section ? `Section: ${section.section}` : null, section.text].filter(Boolean).join("\n");
    for (const content of splitChunkText(base)) {
      chunks.push({ chunkIndex: index, section: section.section, content, contentHash: sha256(`${EMBEDDING_MODEL}\n${content}`) });
      index += 1;
    }
  }
  return chunks;
}

function splitChunkText(text: string): string[] {
  if (text.length <= MAX_TEXT_CHARS) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length && chunks.length < MAX_CHUNKS) {
    const hardEnd = Math.min(text.length, start + MAX_TEXT_CHARS);
    const window = text.slice(start, hardEnd);
    const softBreak = Math.max(window.lastIndexOf(". "), window.lastIndexOf("\n"), window.lastIndexOf("; "));
    const end = softBreak > 500 && hardEnd < text.length ? start + softBreak + 1 : hardEnd;
    const chunk = sanitize(text.slice(start, end), MAX_TEXT_CHARS);
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;
    start = Math.max(0, end - 120);
  }
  return chunks;
}

function sanitize(value: unknown, max: number): string {
  return (typeof value === "string" ? value : "")
    .replace(/<!--[^>]*-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[{}<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function sha256(value: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= code + i;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  const part = `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
  return `${part}${part}${part}${part}`;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
