#!/usr/bin/env node

// Read-only production QA for basic PWA install metadata.
// This does not log in, mutate data, register service workers, or test offline behavior.

const BASE = process.env.LIFE_PULSE_BASE_URL || process.env.LIFE_PULSE_PROD_BASE_URL || "https://lifepulse-sand.vercel.app";

function pass(label) {
  console.log(`  PASS ${label}`);
}

function fail(message) {
  throw new Error(message);
}

function resolveUrl(path) {
  return new URL(path, BASE).toString();
}

async function fetchOk(path) {
  const response = await fetch(resolveUrl(path), { redirect: "follow" });
  if (!response.ok) fail(`${path} returned HTTP ${response.status}`);
  return response;
}

function readPngDimensions(buffer) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) fail("PNG signature is invalid");
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function findIcon(icons, size, purpose) {
  return icons.some((icon) => {
    const purposes = String(icon.purpose || "any").split(/\s+/);
    return icon.sizes === size && icon.type === "image/png" && purposes.includes(purpose);
  });
}

async function assertPng(path, expectedSize) {
  const response = await fetchOk(path);
  const contentType = response.headers.get("content-type") || "";
  const buffer = Buffer.from(await response.arrayBuffer());
  const dimensions = readPngDimensions(buffer);
  if (dimensions.width !== expectedSize || dimensions.height !== expectedSize) {
    fail(`${path} dimensions are ${dimensions.width}x${dimensions.height}, expected ${expectedSize}x${expectedSize}`);
  }
  if (contentType && !contentType.includes("image/png") && !contentType.includes("application/octet-stream")) {
    fail(`${path} content-type is ${contentType}, expected image/png`);
  }
  pass(`${path} is a valid ${expectedSize}x${expectedSize} PNG`);
}

async function main() {
  console.log("");
  console.log("=== Life Pulse PWA Production QA ===");
  console.log(`Base URL: ${BASE}`);
  console.log("Read-only check: manifest, icons, metadata, and absence of service worker control.");
  console.log("");

  const manifestResponse = await fetchOk("/manifest.json");
  pass("/manifest.json returns 200");

  const manifest = await manifestResponse.json();
  pass("Manifest JSON parses successfully");

  for (const field of ["name", "short_name", "start_url", "display", "theme_color", "background_color"]) {
    if (!manifest[field]) fail(`Manifest is missing ${field}`);
    pass(`Manifest has ${field}`);
  }
  if (manifest.display !== "standalone") fail(`Manifest display is ${manifest.display}, expected standalone`);
  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) fail("Manifest icons array is missing or empty");
  pass("Manifest has icons array");

  if (!findIcon(manifest.icons, "192x192", "any")) fail("Manifest missing 192x192 PNG any icon");
  pass("Manifest includes 192x192 PNG any icon");
  if (!findIcon(manifest.icons, "512x512", "any")) fail("Manifest missing 512x512 PNG any icon");
  pass("Manifest includes 512x512 PNG any icon");
  if (!findIcon(manifest.icons, "192x192", "maskable") && !findIcon(manifest.icons, "512x512", "maskable")) {
    fail("Manifest missing maskable PNG icon");
  }
  pass("Manifest includes maskable PNG icon");

  for (const icon of manifest.icons) {
    if (!icon.src) fail("Manifest icon missing src");
    const response = await fetchOk(icon.src);
    if (icon.type === "image/png") {
      const buffer = Buffer.from(await response.arrayBuffer());
      readPngDimensions(buffer);
    }
    pass(`Manifest icon ${icon.src} returns 200`);
  }

  await assertPng("/icon-192.png", 192);
  await assertPng("/icon-512.png", 512);
  await assertPng("/icon-maskable-192.png", 192);
  await assertPng("/icon-maskable-512.png", 512);
  await assertPng("/apple-touch-icon.png", 180);

  const svgResponse = await fetchOk("/icon.svg");
  const svgType = svgResponse.headers.get("content-type") || "";
  if (!svgType.includes("image/svg+xml")) fail(`/icon.svg content-type is ${svgType}, expected image/svg+xml`);
  pass("/icon.svg returns 200 with SVG content type");

  const rootResponse = await fetchOk("/");
  const html = await rootResponse.text();
  if (!html.includes('rel="manifest"') || !html.includes('/manifest.json')) fail("Root page is missing manifest link");
  pass("Root page links manifest");
  if (!html.includes('rel="icon"') || !html.includes('/icon.svg')) fail("Root page is missing icon link");
  pass("Root page links icon");
  if (!html.includes('rel="shortcut icon"') || !html.includes('/icon-192.png')) fail("Root page is missing shortcut PNG icon link");
  pass("Root page links shortcut PNG icon");
  if (!html.includes('rel="apple-touch-icon"') || !html.includes('/apple-touch-icon.png')) fail("Root page is missing apple touch icon link");
  pass("Root page links Apple touch icon PNG");
  if (!html.includes('name="theme-color"') || !html.includes('#0a0a0b')) fail("Root page is missing expected theme color metadata");
  pass("Root page includes theme color metadata");
  if (!html.includes('name="mobile-web-app-capable"') || !html.includes('yes')) fail("Root page is missing mobile web app capable metadata");
  pass("Root page includes mobile web app capable metadata");
  if (!html.includes('name="apple-mobile-web-app-capable"') || !html.includes('yes')) fail("Root page is missing Apple web app capable metadata");
  pass("Root page includes Apple web app capable metadata");

  const forbiddenServiceWorkerPaths = ["/sw.js", "/service-worker.js", "/worker.js"];
  for (const path of forbiddenServiceWorkerPaths) {
    const response = await fetch(resolveUrl(path), { redirect: "manual" });
    if (response.status >= 200 && response.status < 300) fail(`${path} exists; service worker/offline behavior should not be added in this slice`);
  }
  pass("No common service worker file is exposed");

  console.log("");
  console.log("PWA production QA passed.");
  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error("PWA production QA failed.");
  console.error(error instanceof Error ? error.message : String(error));
  console.error("");
  process.exit(1);
});
