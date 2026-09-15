import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * Clear Next's build cache (`.next/`) — but only while no dev server is running.
 *
 * Deleting `.next/` underneath a running server leaves it serving from a cache that is no longer
 * there: the next request fails with a missing-manifest or JSON parse error that points at the app,
 * not at the delete. `.data/` (the local database and uploads) is never touched.
 */
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const port = process.env.PORT ?? "3000";

function portInUse(portNumber) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", (error) => resolve(error.code === "EADDRINUSE"));
    probe.once("listening", () => probe.close(() => resolve(false)));
    probe.listen(Number(portNumber));
  });
}

if (await portInUse(port)) {
  console.error(
    `[clean] Port ${port} is in use — stop the dev server first, then run this again.`
  );
  process.exit(1);
}

fs.rmSync(path.join(projectRoot, ".next"), { recursive: true, force: true });
console.log(
  "[clean] Removed .next/. The local database in .data/ was left alone."
);
