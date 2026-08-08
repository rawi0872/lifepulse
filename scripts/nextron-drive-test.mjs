import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const driveLib = read("src/lib/nextron/drive.ts");
const pickerLoader = read("src/lib/google-picker-loader.ts");
const nextConfig = read("next.config.ts");
const knowledgeHybrid = read("src/lib/nextron/knowledge-hybrid.ts");
const tools = read("src/lib/nextron/project-agent/tools.ts");
const migration = read("supabase/migrations/00027_google_drive_selected_files.sql");
const driveRoute = read("src/app/api/integrations/google/drive/route.ts");
const importsRoute = read("src/app/api/integrations/google/drive/imports/route.ts");
const knowledgePage = read("src/app/knowledge/page.tsx");
const settings = read("src/app/settings/page.tsx");

assert(driveLib.includes('GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"'), "Drive connector must request drive.file only.");
assert(driveLib.includes('GOOGLE_DRIVE_SCOPES = [GOOGLE_DRIVE_SCOPE]'), "Drive scopes must be derived from drive.file only.");
assert(!driveLib.includes("https://www.googleapis.com/auth/drive.readonly") && !driveLib.includes('GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive"'), "Drive lib must not request broad Drive scopes.");
assert(driveLib.includes('GOOGLE_DRIVE_READ_OPERATIONS = ["files_get_metadata", "files_export", "files_get_media"]'), "Drive read operations must be limited to metadata/export/media.");
assert(driveLib.includes('GOOGLE_DRIVE_DENIED_OPERATIONS = ["files_list"'), "Drive denied operation list must explicitly include files_list.");
assert(!driveLib.includes("/files?"), "Drive lib must not call files.list.");
assert(!driveLib.includes("method: \"PATCH\"") && !driveLib.includes("method: \"DELETE\""), "Drive lib must not call Drive write methods.");
assert(driveLib.includes("capabilities/canDownload") && driveLib.includes("DRIVE_DOWNLOAD_DENIED"), "Drive import must check download capability.");
assert(driveLib.includes("MAX_BLOB_BYTES") && driveLib.includes("MAX_EXTRACTED_TEXT_CHARS"), "Drive import must enforce size bounds.");
assert(driveLib.includes('source_provider: "google_drive"'), "Imported Drive files must enter Knowledge v2 as google_drive sources.");
assert(driveLib.includes('body: { action: "index-item"'), "Imported Drive files must reuse Knowledge v2 indexing.");
assert(driveLib.includes("removeDriveImport") && driveLib.includes("disconnectGoogleDrive"), "Drive imports must be removable from Life Pulse.");
assert(driveLib.includes('classifyGoogleOAuthTokenResponse') && driveLib.includes('error instanceof GoogleOAuthRefreshError') && driveLib.includes('status: "revoked", last_error_code: "RECONNECT_REQUIRED"') && driveLib.includes('DRIVE_RECONNECT_REQUIRED'), "Drive permanent refresh failures must become reconnect-required without raw Google error leakage.");

assert(migration.includes("allow_drive boolean not null default false"), "Drive permission must default denied.");
assert(migration.includes("source_provider text not null default 'life_pulse'"), "Knowledge items must keep source provider provenance.");
assert(migration.includes("google_drive_imports"), "Migration must include selected-file provenance table.");
assert(migration.includes("include_google_drive boolean default false"), "Knowledge RPCs must gate Drive content by default.");
assert(migration.includes("include_google_drive or item.source_provider <> 'google_drive'"), "Knowledge RPCs must exclude Drive rows unless explicitly allowed.");

assert(knowledgeHybrid.includes("include_google_drive: options.includeGoogleDrive === true"), "Hybrid search must pass the Drive inclusion flag into RPCs.");
assert(knowledgeHybrid.includes("sourceProvider") && knowledgeHybrid.includes("Google Drive"), "Knowledge results must include Drive provenance labels.");
assert(tools.includes('isNextronContextAllowed(context.permissions, "drive")'), "Knowledge agent must require explicit Drive permission for Drive sources.");
assert(tools.includes('row.source_provider !== "google_drive"'), "Keyword fallback must filter Drive rows when Drive is disabled.");

assert(driveRoute.includes("allowNextronDrive") && driveRoute.includes("disconnectGoogleDrive"), "Drive status route must manage permission and disconnect.");
assert(importsRoute.includes("importSelectedDriveFile") && !importsRoute.includes("files.list"), "Drive import route must import selected files only.");
assert(driveLib.includes('if (reason === "DRIVE_RECONNECT_REQUIRED") return { ok: false, reason }'), "Drive authorization failures must not create import records or duplicate imports.");
assert(knowledgePage.includes("PickerBuilder") && knowledgePage.includes("Select Drive files"), "Knowledge page must expose Google Picker selected-file import.");
assert(knowledgePage.includes("Remove from Drive panel"), "Drive copies must be removed through the Drive import panel.");
assert(knowledgePage.includes('Google Drive needs to be reconnected.') && knowledgePage.includes('tokenResponse.status === 409') && knowledgePage.includes('status: "revoked", lastErrorCode: "RECONNECT_REQUIRED"'), "Knowledge Picker must show reconnect UX instead of generic token refresh failure.");
assert(settings.includes('Reconnect Google Drive') && settings.includes('Your Google authorization expired or was revoked. Reconnect Google Drive to continue.') && settings.includes('disabled={driveSaving || !driveStatus?.connected || driveReconnectRequired}'), "Settings must show Drive reconnect-required state and preserve allow_drive without enabling reads while revoked.");
assert(knowledgePage.includes("drivePickerLaunching") && knowledgePage.includes('"Opening Drive..."') && knowledgePage.includes('"Importing..."'), "Picker launch and file import must use distinct loading states.");
assert(knowledgePage.includes("if (drivePickerLaunching || drivePickerOpen || driveImporting) return"), "Duplicate Picker launch clicks must be blocked while launch, Picker, or import is active.");
assert(knowledgePage.includes('fetch("/api/integrations/google/drive/picker-token", { method: "POST" })') && knowledgePage.includes("tokenPayload.accessToken"), "Picker launch must request and validate the server-issued Picker token.");
assert(knowledgePage.includes("driveStatus.picker.apiKey") && knowledgePage.includes("driveStatus.picker.appId"), "Picker launch must require API key and App ID config before building.");
assert(knowledgePage.includes("const picker = new pickerApi.PickerBuilder()") && knowledgePage.includes(".addView(view)") && knowledgePage.includes(".setOAuthToken(tokenPayload.accessToken)") && knowledgePage.includes(".setDeveloperKey(driveStatus.picker.apiKey)") && knowledgePage.includes(".setAppId(driveStatus.picker.appId)") && knowledgePage.includes(".setCallback((data) =>"), "Picker builder must receive view, token, key, App ID, and callback.");
assert(knowledgePage.includes(".setOrigin(window.location.origin)"), "Picker builder must set the current web origin explicitly.");
assert(knowledgePage.includes("picker.setVisible(true)") && knowledgePage.includes("PICKER_VISIBLE_FAILED"), "Picker launch must call setVisible(true) and classify visible failures.");
assert(knowledgePage.includes("setDrivePickerOpen(false)") && knowledgePage.includes("data.action !== pickerApi.Action.PICKED"), "Picker cancel/non-picked callback must reset Picker-open state.");
assert(knowledgePage.includes("setDriveImporting(true)") && knowledgePage.includes("void importDriveDocs(data.docs)"), "Picked files must transition to import only after PICKED callback.");
assert(knowledgePage.indexOf("void importDriveDocs(data.docs)") > knowledgePage.indexOf("data.action !== pickerApi.Action.PICKED"), "Drive import must not run before the PICKED guard.");
assert(knowledgePage.includes("setDrivePickerLaunching(false)"), "Picker token, config, builder, and visible failures must reset launch loading state.");

assert(pickerLoader.includes('GOOGLE_PICKER_API_SCRIPT_URL = "https://apis.google.com/js/api.js"'), "Picker loader must use the official Google API loader script.");
assert(pickerLoader.includes("if (isGapiReady()) return Promise.resolve()") && pickerLoader.includes("if (isPickerReady()) return"), "Picker loader must reuse existing loaded gapi and picker state.");
assert(pickerLoader.includes("if (apiScriptPromise) return apiScriptPromise") && pickerLoader.includes("if (pickerModulePromise) return pickerModulePromise"), "Picker loader must share simultaneous script and picker module loads.");
assert(pickerLoader.includes('reject(new Error("SCRIPT_LOAD_FAILED"))') && pickerLoader.includes('reject(new Error("PICKER_LOAD_FAILED"))'), "Picker loader must return safe errors for script and picker module failures.");
assert((pickerLoader.match(/apiScriptPromise = null/g) ?? []).length >= 2 && pickerLoader.includes("pickerModulePromise = null"), "Picker loader must allow retry after prior script or picker failure.");
assert(pickerLoader.includes('window.gapi?.load("picker"') && pickerLoader.includes("PickerBuilder"), "Picker loader must resolve only after the Picker module callback exposes PickerBuilder.");
assert(!pickerLoader.includes("console.") && !knowledgePage.includes("console.log(token") && !knowledgePage.includes("console.log(driveStatus.picker"), "Picker path must not log API keys or OAuth tokens.");
assert(!pickerLoader.includes("files.list") && !knowledgePage.includes("files.list") && !driveLib.includes("files.list"), "Picker fix must not add a Drive listing fallback.");
assert(nextConfig.includes("script-src 'self' 'unsafe-inline' https://apis.google.com") && nextConfig.includes("frame-src 'self' https://docs.google.com https://drive.google.com https://accounts.google.com"), "Production CSP must minimally allow Google Picker script and frame origins.");

console.log("NEXTRON Drive selected-files contract checks passed.");
