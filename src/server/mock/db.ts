import "server-only";

import type { MockDb } from "@/server/mock/types";
import { buildSeed } from "@/server/mock/seed";
import {
  StaleSnapshotError,
  USING_BLOB,
  readBundledSeed,
  readSnapshot,
  writeSnapshot,
} from "@/server/mock/storage";

/**
 * Prototype persistence: the whole domain as one JSON snapshot, plus uploaded files, both held by
 * whichever backend `storage.ts` selects — the local disk in development, Vercel Blob wherever a
 * store is connected. This module owns the shape and the read/modify/write cycle; it no longer
 * knows where the bytes land.
 *
 * The snapshot is deliberately re-read on every `readDb()` rather than cached in module scope.
 * With more than one serverless instance serving traffic, a cached copy is a copy of what *this*
 * instance last saw, and the instance that served the write is usually not the one serving the
 * next read — which is exactly how a successful save appears to vanish.
 */

/** Serialises writes so two overlapping mutations in this instance cannot clobber each other. */
let queue: Promise<unknown> = Promise.resolve();

/** The database plus the version tag a write has to quote to be accepted (see `writeSnapshot`). */
interface Loaded {
  db: MockDb;
  etag?: string;
}

async function load(): Promise<Loaded> {
  const raw = await readSnapshot();
  if (raw) {
    try {
      return { db: JSON.parse(raw.json) as MockDb, etag: raw.etag };
    } catch {
      // A truncated or half-written snapshot: fall through and rebuild rather than crash every
      // page with a JSON parse error.
    }
  }

  // Nothing stored yet. On disk-backed local dev, prefer whatever `.data/imgc-db.json` already
  // holds over generating fresh — same idea as any other on-disk cache. On Blob, skip that
  // entirely and always regenerate from `buildSeed()`: `.data/` is gitignored, so it is never a
  // deployment's real seed — it is one developer's local scratch state, in whatever shape their
  // last local session left it. `vercel --prod` uploads the working directory as-is (it is not a
  // git-based deploy), so a `.data/imgc-db.json` sitting on disk when the CLI runs ships with the
  // bundle and — before this — got read right back as the "official" seed the moment the Blob
  // store was empty. That's precisely how a production reseed once came back already showing a
  // reviewer's local rejection/approval history: not a persistence bug, a seed-source bug, and one
  // `buildSeed()` (deterministic, code-defined, no filesystem read) can't reproduce.
  const bundled = USING_BLOB ? null : await readBundledSeed();
  let seeded: MockDb;
  if (bundled) {
    try {
      seeded = JSON.parse(bundled) as MockDb;
    } catch {
      seeded = buildSeed();
    }
  } else {
    seeded = buildSeed();
  }

  await writeSnapshot(JSON.stringify(seeded, null, 2));
  // Re-read rather than assume: the write above may have lost a race with another instance
  // seeding at the same moment, and the stored copy is the one everyone else will now build on.
  const stored = await readSnapshot();
  if (stored) {
    try {
      return { db: JSON.parse(stored.json) as MockDb, etag: stored.etag };
    } catch {
      /* fall through to the copy we just built */
    }
  }
  return { db: seeded };
}

/** A read-only snapshot of the database. Do not mutate the result — go through `writeDb`. */
export async function readDb(): Promise<MockDb> {
  return (await load()).db;
}

/**
 * Apply `mutator` to the database and persist the result. Mutations are queued, so callers can
 * `await writeDb(...)` without racing. The mutator may return a value, which is passed back.
 *
 * The snapshot is re-read inside the queue, immediately before the mutation, so each write builds
 * on the latest stored state rather than on whatever this instance happened to load earlier.
 *
 * The queue only serialises writes *within one instance*, which is not enough on Vercel: two
 * requests seconds apart routinely land on two different instances, and the second one's read can
 * still predate the first one's write. So the write itself is conditional — it quotes the version
 * it read (see `writeSnapshot`) — and a rejected write is retried here against freshly-read state
 * rather than lost. The mutator runs again on that newer copy, so the two changes compose.
 *
 * That means a mutator must be safe to run more than once. They all are: each one looks its target
 * up in the `db` it is handed and edits that, so re-running it against newer state is simply the
 * same edit applied where it belongs.
 */
const WRITE_ATTEMPTS = 5;

export async function writeDb<T>(
  mutator: (db: MockDb) => T | Promise<T>
): Promise<T> {
  const run = queue.then(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt += 1) {
      const { db, etag } = await load();
      const result = await mutator(db);
      try {
        await writeSnapshot(JSON.stringify(db, null, 2), etag);
        return result;
      } catch (error) {
        if (!(error instanceof StaleSnapshotError)) throw error;
        lastError = error;
        // Someone wrote between our read and our write. Back off briefly — long enough for the
        // winning write to be readable — then redo the whole read/modify/write on top of it.
        await new Promise((resolve) => setTimeout(resolve, 120 * (attempt + 1)));
      }
    }
    throw lastError;
  });
  // Keep the chain alive even if this mutation throws.
  queue = run.catch(() => undefined);
  return run;
}

/** Test/dev helper — kept for callers; reads always hit storage, so there is no cache to drop. */
export function resetDbCache(): void {
  // Intentionally empty: `load()` re-reads the snapshot every time.
}

export { USING_BLOB };
