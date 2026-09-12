// Test-only ESM loader: resolves extensionless relative imports to .ts
// files so domain modules (written for bundler resolution) import under
// plain `node --test`. No runtime impact on the app.
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

export async function resolve(specifier, context, next) {
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
