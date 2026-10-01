import "server-only";

import fs from "node:fs";
import path from "node:path";

/**
 * Where the local disk store keeps its files.
 *
 * Every app runs from its own folder (`apps/claims`, `apps/shell`, …), and `process.cwd()` is that
 * folder — so a store anchored there would be a different, private copy per zone. In disk mode all
 * zones must read and write the same files, so the location is anchored at the workspace root,
 * found by walking up to `pnpm-workspace.yaml`. A deployment that ships a single app has no
 * workspace file above it and falls back to its own folder, exactly as before.
 */
function findWorkspaceRoot(start: string): string | null {
  let dir = start;
  for (;;) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- walks up from process.cwd(); no request input
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const root = findWorkspaceRoot(process.cwd());

/** The workspace root, or this app's own folder when it is deployed on its own. */
export function repoRoot(): string {
  return root ?? process.cwd();
}

/** `.data/` — the local database snapshot and uploaded files, shared by every zone. */
export function dataDir(): string {
  return path.join(repoRoot(), ".data");
}

/** Places a `public/` asset may be read from, most likely first. */
export function publicDirCandidates(): string[] {
  return [
    path.join(process.cwd(), "public"),
    path.join(repoRoot(), "apps", "shell", "public"),
    path.join(repoRoot(), "public"),
    path.join(process.cwd(), ".next", "standalone", "public"),
    path.join("/var/task", "public"),
  ];
}
