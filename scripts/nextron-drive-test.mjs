import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const driveLib = read("src/lib/nextron/drive.ts");
const knowledgeHybrid = read("src/lib/nextron/knowledge-hybrid.ts");
const tools = read("src/lib/nextron/project-agent/tools.ts");
const migration = read("supabase/migrations/00027_google_drive_selected_files.sql");
const driveRoute = read("src/app/api/integrations/google/drive/route.ts");
const importsRoute = read("src/app/api/integrations/google/drive/imports/route.ts");
const knowledgePage = read("src/app/knowledge/page.tsx");

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
assert(knowledgePage.includes("PickerBuilder") && knowledgePage.includes("Select Drive files"), "Knowledge page must expose Google Picker selected-file import.");
assert(knowledgePage.includes("Remove from Drive panel"), "Drive copies must be removed through the Drive import panel.");

console.log("NEXTRON Drive selected-files contract checks passed.");
