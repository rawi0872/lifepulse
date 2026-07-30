import type { SupabaseClient } from "@supabase/supabase-js";
import { contentHash, sanitizeKnowledgeText } from "@/lib/nextron/knowledge-hybrid";
import { createOAuthState, encryptCalendarTokens, decryptCalendarTokens, revokeGoogleCalendarToken, sha256Base64Url } from "@/lib/nextron/calendar";

export const GOOGLE_DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
export const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const GOOGLE_DRIVE_SCOPES = [GOOGLE_DRIVE_SCOPE] as const;
export const GOOGLE_DRIVE_READ_OPERATIONS = ["files_get_metadata", "files_export", "files_get_media"] as const;
export const GOOGLE_DRIVE_DENIED_OPERATIONS = ["files_list", "files_create", "files_update", "files_delete", "permissions_create", "permissions_update", "permissions_delete"] as const;

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const TEXT_MIME_TYPES = new Set(["text/plain", "text/markdown", "text/x-markdown"]);
const DRIVE_TIMEOUT_MS = 15_000;
const MAX_BLOB_BYTES = 256_000;
const MAX_EXTRACTED_TEXT_CHARS = 60_000;

type DriveReadOperation = typeof GOOGLE_DRIVE_READ_OPERATIONS[number];

interface DriveTokenSet {
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  scope?: string;
  token_type?: string;
}

export interface DriveConnectionRow {
  user_id: string;
  encrypted_tokens: string;
  token_iv: string;
  token_tag: string;
  scopes: string[] | null;
  token_expires_at: string | null;
  google_account_hint: string | null;
  status: "connected" | "error" | "revoked";
  last_error_code: string | null;
}

export interface DriveImportRow {
  id: string;
  user_id: string;
  google_drive_file_id: string;
  resource_key: string | null;
  display_title: string;
  mime_type: string;
  drive_modified_at: string | null;
  imported_at: string;
  last_synced_at: string | null;
  status: "active" | "removed" | "error" | "unsupported" | "too_large";
  last_error_code: string | null;
  content_hash: string | null;
  content_size: number | null;
  knowledge_item_id: string | null;
}

interface DriveMetadata {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  capabilities?: { canDownload?: boolean };
}

export function getGoogleDriveEnv() {
  return {
    clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim() || "",
    clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim() || "",
    redirectUri: process.env.GOOGLE_DRIVE_REDIRECT_URI?.trim() || "",
    encryptionKey: process.env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY?.trim() || "",
    pickerApiKey: process.env.GOOGLE_DRIVE_PICKER_API_KEY?.trim() || "",
    pickerAppId: process.env.GOOGLE_DRIVE_PICKER_APP_ID?.trim() || "",
  };
}

export function missingGoogleDriveEnv(): string[] {
  const env = getGoogleDriveEnv();
  const missing: string[] = [];
  if (!env.clientId) missing.push("GOOGLE_CALENDAR_CLIENT_ID");
  if (!env.clientSecret) missing.push("GOOGLE_CALENDAR_CLIENT_SECRET");
  if (!env.redirectUri) missing.push("GOOGLE_DRIVE_REDIRECT_URI");
  if (!env.encryptionKey) missing.push("GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY");
  if (!env.pickerApiKey) missing.push("GOOGLE_DRIVE_PICKER_API_KEY");
  if (!env.pickerAppId) missing.push("GOOGLE_DRIVE_PICKER_APP_ID");
  return missing;
}

export { createOAuthState, sha256Base64Url };

export function buildGoogleDriveAuthUrl(state: string): string {
  const env = getGoogleDriveEnv();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.clientId);
  url.searchParams.set("redirect_uri", env.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_DRIVE_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  return url.toString();
}

export async function exchangeGoogleDriveCode(code: string): Promise<DriveTokenSet> {
  const env = getGoogleDriveEnv();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: env.clientId, client_secret: env.clientSecret, redirect_uri: env.redirectUri, grant_type: "authorization_code" }),
  });
  if (!response.ok) throw new Error("GOOGLE_DRIVE_TOKEN_EXCHANGE_FAILED");
  const token = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; token_type?: string };
  if (!token.access_token) throw new Error("GOOGLE_DRIVE_TOKEN_MISSING");
  return { access_token: token.access_token, refresh_token: token.refresh_token, expires_at: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : undefined, scope: token.scope, token_type: token.token_type };
}

async function refreshGoogleDriveToken(refreshToken: string): Promise<DriveTokenSet> {
  const env = getGoogleDriveEnv();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.clientId, client_secret: env.clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  if (!response.ok) throw new Error("GOOGLE_DRIVE_TOKEN_REFRESH_FAILED");
  const token = await response.json() as { access_token?: string; expires_in?: number; scope?: string; token_type?: string };
  if (!token.access_token) throw new Error("GOOGLE_DRIVE_TOKEN_MISSING");
  return { access_token: token.access_token, refresh_token: refreshToken, expires_at: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : undefined, scope: token.scope, token_type: token.token_type };
}

export function isAllowedDriveReadOperation(operation: string): operation is DriveReadOperation {
  return (GOOGLE_DRIVE_READ_OPERATIONS as readonly string[]).includes(operation) && !(GOOGLE_DRIVE_DENIED_OPERATIONS as readonly string[]).includes(operation);
}

async function getUsableDriveTokens(supabase: SupabaseClient, row: DriveConnectionRow): Promise<DriveTokenSet> {
  let tokens: DriveTokenSet;
  try {
    tokens = await decryptCalendarTokens(row) as DriveTokenSet;
  } catch {
    throw new Error("TOKEN_DECRYPT_FAILED");
  }
  const expiresAt = tokens.expires_at ? Date.parse(tokens.expires_at) : 0;
  if (!expiresAt || expiresAt - Date.now() > 60_000) return tokens;
  if (!tokens.refresh_token) throw new Error("TOKEN_UNAVAILABLE");
  let refreshed: DriveTokenSet;
  try {
    refreshed = await refreshGoogleDriveToken(tokens.refresh_token);
  } catch {
    throw new Error("TOKEN_REFRESH_FAILED");
  }
  const encrypted = await encryptCalendarTokens(refreshed);
  await supabase.from("google_drive_connections").update({ ...encrypted, token_expires_at: refreshed.expires_at ?? null, status: "connected", last_error_code: null }).eq("user_id", row.user_id);
  return refreshed;
}

export async function getGoogleDrivePickerToken(supabase: SupabaseClient, userId: string): Promise<{ ok: true; accessToken: string; expiresAt: string | null } | { ok: false; reason: string }> {
  const { data } = await supabase.from("google_drive_connections").select("user_id, encrypted_tokens, token_iv, token_tag, scopes, token_expires_at, google_account_hint, status, last_error_code").eq("user_id", userId).maybeSingle();
  const row = data as DriveConnectionRow | null;
  if (!row || row.status !== "connected" || !row.scopes?.includes(GOOGLE_DRIVE_SCOPE)) return { ok: false, reason: "DRIVE_DISCONNECTED" };
  try {
    const tokens = await getUsableDriveTokens(supabase, row);
    return { ok: true, accessToken: tokens.access_token, expiresAt: tokens.expires_at ?? null };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "TOKEN_UNAVAILABLE" };
  }
}

async function callGoogleDriveRest(operation: DriveReadOperation, accessToken: string, init: { path: string; query?: Record<string, string>; acceptText?: boolean; resourceKey?: string | null }): Promise<Response> {
  if (!isAllowedDriveReadOperation(operation)) throw new Error("DRIVE_OPERATION_DENIED");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DRIVE_TIMEOUT_MS);
  const url = new URL(`${GOOGLE_DRIVE_API_BASE}${init.path}`);
  for (const [key, value] of Object.entries(init.query ?? {})) url.searchParams.set(key, value);
  if (init.resourceKey) url.searchParams.set("resourceKey", init.resourceKey);
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: init.acceptText ? "text/plain" : "application/json" }, signal: controller.signal });
    if (!response.ok) {
      if (response.status === 401) throw new Error("DRIVE_AUTH_REQUIRED");
      if (response.status === 403) throw new Error("DRIVE_SCOPE_DENIED");
      if (response.status === 404) throw new Error("DRIVE_FILE_INACCESSIBLE");
      if (response.status === 400) throw new Error("DRIVE_BAD_REQUEST");
      if (response.status === 429) throw new Error("DRIVE_RATE_LIMITED");
      throw new Error("DRIVE_API_UNAVAILABLE");
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function safeTitle(value: string): string {
  return sanitizeKnowledgeText(value, 140) || "Untitled Drive document";
}

function normalizeDriveText(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ").replace(/\n{4,}/g, "\n\n\n").trim();
}

function unsupportedReason(metadata: DriveMetadata): string | null {
  if (metadata.mimeType === GOOGLE_DOC_MIME || TEXT_MIME_TYPES.has(metadata.mimeType)) return null;
  return "UNSUPPORTED_FILE_TYPE";
}

async function readSelectedDriveFile(accessToken: string, fileId: string, resourceKey?: string | null): Promise<{ metadata: DriveMetadata; text: string; hash: string }> {
  const metadataResponse = await callGoogleDriveRest("files_get_metadata", accessToken, {
    path: `/files/${encodeURIComponent(fileId)}`,
    resourceKey,
    query: { fields: "id,name,mimeType,modifiedTime,size,capabilities/canDownload" },
  });
  const metadata = await metadataResponse.json() as DriveMetadata;
  const reason = unsupportedReason(metadata);
  if (reason) throw new Error(reason);
  if (metadata.capabilities?.canDownload === false) throw new Error("DRIVE_DOWNLOAD_DENIED");
  if (metadata.size && Number(metadata.size) > MAX_BLOB_BYTES) throw new Error("FILE_TOO_LARGE");

  const contentResponse = metadata.mimeType === GOOGLE_DOC_MIME
    ? await callGoogleDriveRest("files_export", accessToken, { path: `/files/${encodeURIComponent(fileId)}/export`, resourceKey, query: { mimeType: "text/plain" }, acceptText: true })
    : await callGoogleDriveRest("files_get_media", accessToken, { path: `/files/${encodeURIComponent(fileId)}`, resourceKey, query: { alt: "media" }, acceptText: true });
  const raw = await contentResponse.text();
  if (raw.length > MAX_EXTRACTED_TEXT_CHARS) throw new Error("FILE_TOO_LARGE");
  const text = normalizeDriveText(raw);
  if (!text) throw new Error("EMPTY_FILE");
  return { metadata, text, hash: contentHash(`${metadata.id}\n${metadata.modifiedTime ?? ""}\n${text}`) };
}

export async function importSelectedDriveFile(args: { supabase: SupabaseClient; userId: string; fileId: string; resourceKey?: string | null }): Promise<{ ok: true; importId: string; title: string; knowledgeItemId: string; unchanged: boolean } | { ok: false; reason: string }> {
  if (!/^[A-Za-z0-9_-]{8,200}$/.test(args.fileId)) return { ok: false, reason: "INVALID_FILE_ID" };
  if (missingGoogleDriveEnv().length > 0) return { ok: false, reason: "ENV_MISSING" };
  const { data } = await args.supabase.from("google_drive_connections").select("user_id, encrypted_tokens, token_iv, token_tag, scopes, token_expires_at, google_account_hint, status, last_error_code").eq("user_id", args.userId).maybeSingle();
  const row = data as DriveConnectionRow | null;
  if (!row || row.status !== "connected" || !row.scopes?.includes(GOOGLE_DRIVE_SCOPE)) return { ok: false, reason: "DRIVE_DISCONNECTED" };
  try {
    const tokens = await getUsableDriveTokens(args.supabase, row);
    const file = await readSelectedDriveFile(tokens.access_token, args.fileId, args.resourceKey);
    const now = new Date().toISOString();
    const existing = await args.supabase.from("google_drive_imports").select("id, knowledge_item_id, content_hash").eq("user_id", args.userId).eq("google_drive_file_id", args.fileId).maybeSingle();
    if (!existing.error && existing.data?.content_hash === file.hash && existing.data.knowledge_item_id) {
      await args.supabase.from("google_drive_imports").update({ last_synced_at: now, status: "active", last_error_code: null }).eq("id", existing.data.id).eq("user_id", args.userId);
      return { ok: true, importId: existing.data.id as string, title: safeTitle(file.metadata.name), knowledgeItemId: existing.data.knowledge_item_id as string, unchanged: true };
    }

    const title = safeTitle(file.metadata.name);
    const summary = `Imported from Google Drive${file.metadata.modifiedTime ? `; Drive modified ${file.metadata.modifiedTime.slice(0, 10)}` : ""}.`;
    const itemPayload = { user_id: args.userId, title, type: "resource", category: "Other", source_url: null, summary, content: file.text, status: "active", source_provider: "google_drive" };
    const itemResult = existing.data?.knowledge_item_id
      ? await args.supabase.from("knowledge_items").update(itemPayload).eq("id", existing.data.knowledge_item_id).eq("user_id", args.userId).select("id").single()
      : await args.supabase.from("knowledge_items").insert(itemPayload).select("id").single();
    if (itemResult.error || !itemResult.data?.id) return { ok: false, reason: "KNOWLEDGE_SAVE_FAILED" };

    const importPayload = {
      user_id: args.userId,
      google_drive_file_id: args.fileId,
      resource_key: args.resourceKey ?? null,
      display_title: title,
      mime_type: file.metadata.mimeType,
      drive_modified_at: file.metadata.modifiedTime ?? null,
      last_synced_at: now,
      status: "active",
      last_error_code: null,
      content_hash: file.hash,
      content_size: file.text.length,
      knowledge_item_id: itemResult.data.id as string,
    };
    const importResult = await args.supabase.from("google_drive_imports").upsert(importPayload, { onConflict: "user_id,google_drive_file_id" }).select("id").single();
    if (importResult.error || !importResult.data?.id) return { ok: false, reason: "IMPORT_SAVE_FAILED" };
    await args.supabase.functions.invoke("knowledge-embed", { body: { action: "index-item", itemId: itemResult.data.id } }).catch(() => undefined);
    return { ok: true, importId: importResult.data.id as string, title, knowledgeItemId: itemResult.data.id as string, unchanged: false };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "DRIVE_API_UNAVAILABLE";
    const status = reason === "UNSUPPORTED_FILE_TYPE" ? "unsupported" : reason === "FILE_TOO_LARGE" ? "too_large" : "error";
    try {
      await args.supabase.from("google_drive_imports").upsert({
        user_id: args.userId,
        google_drive_file_id: args.fileId,
        resource_key: args.resourceKey ?? null,
        display_title: "Google Drive file",
        mime_type: "unknown",
        status,
        last_error_code: reason,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: "user_id,google_drive_file_id" });
    } catch {}
    return { ok: false, reason };
  }
}

export async function listDriveImports(supabase: SupabaseClient, userId: string): Promise<Array<Pick<DriveImportRow, "id" | "display_title" | "mime_type" | "drive_modified_at" | "last_synced_at" | "status" | "last_error_code" | "content_size">>> {
  const { data } = await supabase
    .from("google_drive_imports")
    .select("id, display_title, mime_type, drive_modified_at, last_synced_at, status, last_error_code, content_size")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);
  return (data ?? []) as Array<Pick<DriveImportRow, "id" | "display_title" | "mime_type" | "drive_modified_at" | "last_synced_at" | "status" | "last_error_code" | "content_size">>;
}

export async function refreshDriveImport(supabase: SupabaseClient, userId: string, importId: string): Promise<{ ok: true; importId: string; title: string; knowledgeItemId: string; unchanged: boolean } | { ok: false; reason: string }> {
  const { data } = await supabase.from("google_drive_imports").select("google_drive_file_id, resource_key").eq("id", importId).eq("user_id", userId).maybeSingle();
  const row = data as Pick<DriveImportRow, "google_drive_file_id" | "resource_key"> | null;
  if (!row) return { ok: false, reason: "IMPORT_NOT_FOUND" };
  return importSelectedDriveFile({ supabase, userId, fileId: row.google_drive_file_id, resourceKey: row.resource_key });
}

export async function removeDriveImport(supabase: SupabaseClient, userId: string, importId: string): Promise<boolean> {
  const { data } = await supabase.from("google_drive_imports").select("id, knowledge_item_id").eq("id", importId).eq("user_id", userId).maybeSingle();
  const row = data as Pick<DriveImportRow, "id" | "knowledge_item_id"> | null;
  if (!row) return false;
  if (row.knowledge_item_id) await supabase.from("knowledge_items").delete().eq("id", row.knowledge_item_id).eq("user_id", userId);
  await supabase.from("google_drive_imports").delete().eq("id", importId).eq("user_id", userId);
  return true;
}

export async function disconnectGoogleDrive(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data } = await supabase.from("google_drive_connections").select("user_id, encrypted_tokens, token_iv, token_tag, scopes, token_expires_at, google_account_hint, status, last_error_code").eq("user_id", userId).maybeSingle();
  const row = data as DriveConnectionRow | null;
  if (row) {
    try {
      const tokens = await decryptCalendarTokens(row) as DriveTokenSet;
      await revokeGoogleCalendarToken(tokens.refresh_token ?? tokens.access_token);
    } catch {}
  }
  const { data: imports } = await supabase.from("google_drive_imports").select("id, knowledge_item_id").eq("user_id", userId);
  for (const item of (imports ?? []) as Array<Pick<DriveImportRow, "id" | "knowledge_item_id">>) {
    if (item.knowledge_item_id) await supabase.from("knowledge_items").delete().eq("id", item.knowledge_item_id).eq("user_id", userId);
  }
  await supabase.from("google_drive_imports").delete().eq("user_id", userId);
  await supabase.from("google_drive_connections").delete().eq("user_id", userId);
}
