import { Platform } from "react-native";
import { supabase } from "./supabase";

// Web origin for NEXTRON API — mobile talks to the same Next.js deployment as web.
// Production default is the deployed Vercel URL; local dev can override via EXPO_PUBLIC_WEB_URL.
function getWebBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_WEB_URL || process.env.EXPO_PUBLIC_NEXT_API_URL;
  if (configured) return configured.replace(/\/$/, "");
  // In dev, Android emulator needs 10.0.2.2, iOS simulator/web needs localhost; fallback to production for release builds
  if (__DEV__) {
    // Life Pulse dev server runs on :3001 (port 3000 belongs to CPA OS)
    return Platform.OS === "android" ? "http://10.0.2.2:3001" : "http://localhost:3001";
  }
  return "https://lifepulse-sand.vercel.app";
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function authHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export type NextronAskResult =
  | { ok: true; response: unknown; conversation: unknown; messages: unknown[]; source: string }
  | { ok: false; error: string; code: string; status: number };

export async function nextronAsk(opts: {
  prompt: string;
  conversationId?: string | null;
  clientMessageId?: string | null;
}): Promise<NextronAskResult> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(await authHeaders()),
  };
  // Fail fast if no token
  if (!headers || !("Authorization" in headers)) {
    return { ok: false, error: "Not signed in", code: "AUTH_REQUIRED", status: 401 };
  }
  const url = `${getWebBaseUrl()}/api/nextron/ask`;
  const body: Record<string, unknown> = { prompt: opts.prompt };
  if (opts.conversationId) body.conversationId = opts.conversationId;
  if (opts.clientMessageId) body.clientMessageId = opts.clientMessageId;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) {
      const code = typeof json?.code === "string" ? json.code : "UNKNOWN";
      const error = typeof json?.error === "string" ? json.error : `Request failed ${res.status}`;
      return { ok: false, error, code, status: res.status };
    }
    if (!json || !json.response) {
      return { ok: false, error: "Invalid response", code: "INVALID_RESPONSE", status: 500 };
    }
    return {
      ok: true,
      response: json.response,
      conversation: json.conversation,
      messages: Array.isArray(json.messages) ? (json.messages as unknown[]) : [],
      source: typeof json.source === "string" ? json.source : "unknown",
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Network error";
    return { ok: false, error: message, code: "NETWORK_ERROR", status: 0 };
  }
}

export type NextronConversationSummary = {
  id: string;
  title: string;
  updated_at: string;
  created_at: string;
};

export async function listNextronConversations(): Promise<
  | { ok: true; conversations: NextronConversationSummary[] }
  | { ok: false; error: string; status: number }
> {
  const headers = await authHeaders();
  if (!("Authorization" in headers)) return { ok: false, error: "Not signed in", status: 401 };
  const url = `${getWebBaseUrl()}/api/nextron/conversations`;
  try {
    const res = await fetch(url, { headers });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) return { ok: false, error: typeof json?.error === "string" ? json.error : `Failed ${res.status}`, status: res.status };
    const conversations = Array.isArray(json?.conversations) ? (json!.conversations as NextronConversationSummary[]) : [];
    return { ok: true, conversations };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error", status: 0 };
  }
}

export async function getNextronConversation(id: string): Promise<
  | { ok: true; conversation: unknown; messages: unknown[] }
  | { ok: false; error: string; status: number }
> {
  const headers = await authHeaders();
  if (!("Authorization" in headers)) return { ok: false, error: "Not signed in", status: 401 };
  const url = `${getWebBaseUrl()}/api/nextron/conversations/${id}`;
  try {
    const res = await fetch(url, { headers });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) return { ok: false, error: typeof json?.error === "string" ? json.error : `Failed ${res.status}`, status: res.status };
    return {
      ok: true,
      conversation: json?.conversation,
      messages: Array.isArray(json?.messages) ? (json!.messages as unknown[]) : [],
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error", status: 0 };
  }
}

export function getNextronWebBaseUrlForDebug(): string {
  return getWebBaseUrl();
}
