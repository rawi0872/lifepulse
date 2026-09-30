// Test-only ESM loader: resolves extensionless relative imports to .ts
// files so domain modules (written for bundler resolution) import under
// plain `node --test`. No runtime impact on the app.
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const DOMAIN_PKG = "@lifepulse/domain";
const DOMAIN_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "packages",
  "domain",
);

function resolveDomainTarget(specifier) {
  const sub = specifier === DOMAIN_PKG ? "index.ts" : specifier.slice(DOMAIN_PKG.length + 1);
  const base = path.join(DOMAIN_DIR, sub);
  const candidates = /\.(tsx?|json)$/.test(base)
    ? [base]
    : [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier === DOMAIN_PKG || specifier.startsWith(`${DOMAIN_PKG}/`)) {
    const target = resolveDomainTarget(specifier);
    if (target) {
      return { url: pathToFileURL(target).href, shortCircuit: true };
    }
  }
  try {
    return await next(specifier, context);
  } catch (err) {
    if (err?.code === "ERR_MODULE_NOT_FOUND" && (specifier.startsWith("./") || specifier.startsWith("../"))) {
      const parentPath = fileURLToPath(context.parentURL);
      const base = path.resolve(path.dirname(parentPath), specifier);
      for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
        if (existsSync(candidate)) {
          return { url: pathToFileURL(candidate).href, shortCircuit: true };
        }
      }
    }
    throw err;
  }
}
