/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- reads fixed file names under the repository root, and copies their keys into process.env */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

/**
 * Every app runs from its own folder, but the environment lives once, at the repository root.
 *
 * Next loads `.env*` from the app folder only, so the root files are read here, in Next's own
 * precedence (mode-specific local, local, mode-specific, plain) with a variable that is already
 * set — in the shell, or by an earlier file — always winning.
 */
function loadRootEnv(): void {
  const mode = process.env.NODE_ENV ?? "development";
  const files = [
    `.env.${mode}.local`,
    ...(mode === "test" ? [] : [".env.local"]),
    `.env.${mode}`,
    ".env",
  ];
  for (const name of files) {
    const file = path.join(repoRoot, name);
    if (!fs.existsSync(file)) continue;
    for (const [key, value] of Object.entries(
      parseEnv(fs.readFileSync(file, "utf8"))
    )) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

loadRootEnv();
