#!/usr/bin/env node
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- a developer tool that walks this repository's own packages; no input comes from a request. */
/**
 * Keeps the `exports` map of generated workspace packages in step with their files.
 *
 * A package whose manifest carries `"imgc": { "generatedExports": true }` mixes `.ts` and `.tsx`
 * sources, which a single `"./*"` pattern cannot express — so every module gets its own entry:
 *
 *   packages/ui/ui/button.tsx          →  "./ui/button"
 *   packages/ui/dataTable/index.ts     →  "./dataTable"   (and "./dataTable/index")
 *   packages/ui/styles/theme/colors.css →  "./styles/theme/colors.css"
 *
 * Run `node scripts/syncPackageExports.mjs` after adding, moving or deleting a file in such a
 * package; `--check` (used in CI) fails instead of writing when the map is stale.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

const SOURCE = /\.(ts|tsx)$/;
const SKIP = /(\.d\.ts|\.stories\.tsx?|\.test\.tsx?)$/;

let stale = 0;
for (const pkg of readdirSync(path.join(root, "packages"))) {
  const dir = path.join(root, "packages", pkg);
  const manifestPath = path.join(dir, "package.json");
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    continue;
  }
  if (!manifest.imgc?.generatedExports) continue;

  const exports = {};
  for (const file of walk(dir)) {
    const rel = path.relative(dir, file).split(path.sep).join("/");
    if (SOURCE.test(rel) && !SKIP.test(rel)) {
      const key = "./" + rel.replace(SOURCE, "");
      exports[key] = "./" + rel;
      if (/(^|\/)index$/.test(key)) {
        exports[key.replace(/\/index$/, "") || "."] = "./" + rel;
      }
    } else if (rel.endsWith(".css")) {
      exports["./" + rel] = "./" + rel;
    }
  }
  const sorted = Object.fromEntries(
    Object.entries(exports).sort(([a], [b]) => a.localeCompare(b))
  );

  const before = JSON.stringify(manifest.exports ?? {});
  if (before === JSON.stringify(sorted)) continue;
  stale += 1;
  if (check) {
    console.error(`packages/${pkg}: "exports" is out of date`);
    continue;
  }
  manifest.exports = sorted;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(
    `packages/${pkg}: exports updated (${Object.keys(sorted).length} entries)`
  );
}

if (check && stale > 0) {
  console.error("Run: node scripts/syncPackageExports.mjs");
  process.exit(1);
}
if (stale === 0) console.log("Package exports are up to date.");
