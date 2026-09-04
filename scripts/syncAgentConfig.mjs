/**
 * Sync AI-agent rules + skills from `.cursor/` (canonical) to IDE mirrors.
 *
 * Rules use the identical `.mdc` format; skills use the portable Agent Skills
 * `SKILL.md` standard. This script mirrors folders — it does not merge content.
 *
 * Usage:
 *   node scripts/syncAgentConfig.mjs                 # .cursor → .devin + .windsurf
 *   node scripts/syncAgentConfig.mjs mirrors         # same as default
 *   node scripts/syncAgentConfig.mjs devin           # .cursor → .devin only
 *   node scripts/syncAgentConfig.mjs windsurf        # .cursor → .windsurf only
 *   node scripts/syncAgentConfig.mjs from-windsurf   # .windsurf → .cursor (legacy pull)
 *
 * Edit rules in `.cursor/rules/`, then run `pnpm agent:sync`. `skills-lock.json`
 * stays the single skill manifest.
 */
import { cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const CANONICAL = ".cursor";
const MIRROR_TARGETS = [".devin", ".windsurf"];
const SUBDIRS = ["rules", "skills"];

const mode = (process.argv[2] ?? "mirrors").toLowerCase();

async function exists(path) {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function syncSubdir(fromDir, toDir, subdir) {
  const src = resolve(root, fromDir, subdir);
  const dest = resolve(root, toDir, subdir);

  if (!(await exists(src))) {
    console.log(`• skip ${fromDir}/${subdir} (not present)`);
    return false;
  }

  await rm(dest, { recursive: true, force: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await mkdir(dirname(dest), { recursive: true });
  await cp(src, dest, { recursive: true });
  console.log(`✔ ${fromDir}/${subdir} → ${toDir}/${subdir}`);
  return true;
}

async function syncToTargets(fromDir, targets) {
  let synced = false;
  for (const toDir of targets) {
    for (const subdir of SUBDIRS) {
      if (await syncSubdir(fromDir, toDir, subdir)) {
        synced = true;
      }
    }
  }
  return synced;
}

async function main() {
  if (mode === "from-windsurf") {
    const ok = await syncToTargets(".windsurf", [CANONICAL]);
    if (!ok) {
      console.error("No .windsurf/rules or .windsurf/skills to pull from.");
      process.exit(1);
    }
    console.log(
      "Done. .windsurf → .cursor. Reload your IDE to pick up changes."
    );
    return;
  }

  const targets =
    mode === "mirrors"
      ? MIRROR_TARGETS
      : mode === "devin"
        ? [".devin"]
        : mode === "windsurf"
          ? [".windsurf"]
          : null;

  if (!targets) {
    console.error(
      `Unknown mode "${mode}". Use "mirrors", "devin", "windsurf", or "from-windsurf".`
    );
    process.exit(1);
  }

  const ok = await syncToTargets(CANONICAL, targets);
  if (!ok) {
    console.error(`No ${CANONICAL}/rules or ${CANONICAL}/skills to sync from.`);
    process.exit(1);
  }

  console.log(`Done. ${CANONICAL} → ${targets.join(", ")}. Reload your IDE.`);
}

await main();
