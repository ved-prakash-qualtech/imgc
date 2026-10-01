#!/usr/bin/env node
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- a developer tool that walks this repository's own source tree; no input comes from a request. */
/**
 * Layering check — keeps the workspace acyclic so any package can be built, and any zone deployed,
 * without dragging the rest of the repository along.
 *
 * Packages sit in layers; a package may depend only on packages in a LOWER layer:
 *
 *   0  types, i18n
 *   1  constants, config
 *   2  utils, store
 *   3  lib
 *   4  hooks
 *   5  ui
 *   6  data
 *   7  actions
 *   8  features
 *
 * Apps (`apps/*`, or `src/` while the app is still a single one) sit on top and may use any package.
 *
 * Three rules are checked:
 *  1. every `@imgc/<x>` import in a package resolves to a package in a lower layer;
 *  2. that dependency is declared in the package's `package.json` (so pnpm links it and a
 *     deployment that installs only one app still gets it);
 *  3. a package never imports through an app's `@/` alias.
 *
 * Run: node scripts/checkLayers.mjs   (exit code 1 on any violation)
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const LAYER = {
  types: 0,
  i18n: 0,
  constants: 1,
  config: 1,
  utils: 2,
  store: 2,
  lib: 3,
  hooks: 4,
  ui: 5,
  data: 6,
  actions: 7,
  features: 8,
};

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx|mjs)$/.test(name)) yield full;
  }
}

const IMPORT = /(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g;
const violations = [];
const packagesDir = path.join(root, "packages");

for (const name of readdirSync(packagesDir)) {
  const dir = path.join(packagesDir, name);
  if (
    !statSync(dir).isDirectory() ||
    !existsSync(path.join(dir, "package.json"))
  )
    continue;
  const manifest = JSON.parse(
    readFileSync(path.join(dir, "package.json"), "utf8")
  );
  const declared = new Set(Object.keys(manifest.dependencies ?? {}));
  const myLayer = LAYER[name];
  if (myLayer === undefined) {
    violations.push(
      `packages/${name}: not assigned a layer in scripts/checkLayers.mjs`
    );
    continue;
  }

  for (const file of walk(dir)) {
    const rel = path.relative(root, file).split(path.sep).join("/");
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(IMPORT)) {
      const spec = match[1];
      const line = text.slice(0, match.index).split("\n").length;
      if (spec.startsWith("@/")) {
        violations.push(
          `${rel}:${line}  package imports the app through "${spec}" — use a package import or a relative path`
        );
        continue;
      }
      const target = /^@imgc\/([^/]+)/.exec(spec)?.[1];
      if (!target || target === name) continue;
      const targetLayer = LAYER[target];
      if (targetLayer === undefined) {
        violations.push(
          `${rel}:${line}  imports unknown package @imgc/${target}`
        );
      } else if (targetLayer >= myLayer) {
        violations.push(
          `${rel}:${line}  ${name} (layer ${myLayer}) imports ${target} (layer ${targetLayer}) — "${spec}"`
        );
      }
      if (!declared.has(`@imgc/${target}`)) {
        violations.push(
          `${rel}:${line}  imports @imgc/${target} but packages/${name}/package.json does not declare it`
        );
      }
    }
  }
}

// Apps may use any package; only check they do not name a package that does not exist.
for (const appRoot of [path.join(root, "src"), path.join(root, "apps")].filter(
  existsSync
)) {
  for (const file of walk(appRoot)) {
    const rel = path.relative(root, file).split(path.sep).join("/");
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(IMPORT)) {
      const target = /^@imgc\/([^/]+)/.exec(match[1])?.[1];
      if (target && LAYER[target] === undefined) {
        const line = text.slice(0, match.index).split("\n").length;
        violations.push(
          `${rel}:${line}  imports unknown package @imgc/${target}`
        );
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`Layering violations (${violations.length}):\n`);
  for (const v of violations) console.error("  " + v);
  console.error(
    "\nA package may only depend on packages in a lower layer, and must declare each one. See scripts/checkLayers.mjs."
  );
  process.exit(1);
}
console.log(
  "Layering OK — packages depend only downward, and every dependency is declared."
);
