import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";

import type { AuditEvent, MockDb } from "@/server/mock/types";
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
 * Every read is of the whole snapshot, so the number of reads and writes a request makes is what
 * decides how fast it is. Two scopes keep that number to what the request actually needs:
 *
 * - A **Server Action** runs inside `withDbTransaction` (see `runAction`): the snapshot is loaded
 *   once, every `readDb`/`writeDb` inside the action works on that one in-memory copy, and a
 *   single conditional write persists all of it at the end. One button press used to be a chain
 *   of separate whole-snapshot round trips — the action's own change, then its audit event, its
 *   mail, its notification — each of which could lose a race on its own, retry, and leave the
 *   action half-applied when it finally gave up.
 * - Anything else — a page render, a route handler — shares one load per request (`readDb` is
 *   memoised per request). Nothing is cached *across* requests: with more than one serverless
 *   instance serving traffic, a cached copy is only what this instance last saw, and the instance
 *   that served a write is usually not the one serving the next read.
 *
 * The audit log is a second snapshot of its own (`readAuditLog` / `appendAudit`). It only grows,
 * and only the audit screens read it; every other page needs just each account's last activity
 * time, which the account now carries itself. An action's log entries are written once its main
 * write has landed, so a retried action cannot log twice.
 */

/** Serialises writes so two overlapping commits in this instance cannot clobber each other. */
let queue: Promise<unknown> = Promise.resolve();

/** The database plus the version tag a write has to quote to be accepted (see `writeSnapshot`). */
interface Loaded {
  db: MockDb;
  etag?: string;
}

/**
 * Backfills collections added to `MockDb` after a snapshot was written, so an older persisted
 * database (local disk, or a Blob store from before this field existed) doesn't crash the first
 * time something reads it — same idea as an optional field on a row, just for a whole collection.
 */
function normalize(db: MockDb): MockDb {
  return {
    ...db,
    lenderDocumentRequirements: db.lenderDocumentRequirements ?? [],
  };
}

/**
 * Minified: indenting the snapshot made every read and every write about a third larger. The audit
 * log is left out — it has its own snapshot.
 */
function serialize(db: MockDb): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { auditEvents: _auditEvents, ...rest } = db;
  return JSON.stringify(rest);
}

/**
 * Move an audit log still held inside the main snapshot — one written before the log had its own
 * snapshot, or a fresh seed — into the audit snapshot, and stamp each account with its last
 * activity time from it.
 *
 * Writes go straight to storage rather than through `queue`, because this runs inside `load()`,
 * which `writeDb` calls from inside the queue.
 */
async function moveAuditOut(
  db: MockDb,
  etag: string | undefined
): Promise<void> {
  const events = db.auditEvents ?? [];
  const latest = new Map<string, string>();
  for (const e of events) {
    const current = latest.get(e.accountId);
    if (!current || e.at > current) latest.set(e.accountId, e.at);
  }
  for (const account of db.accounts) {
    const at = latest.get(account.id);
    if (at && (!account.lastActivityAt || at > account.lastActivityAt)) {
      account.lastActivityAt = at;
    }
  }

  // Only the first move fills the audit snapshot; one that already exists is newer than this copy.
  if (!(await readSnapshot("audit"))) {
    await writeSnapshot(JSON.stringify(events), undefined, "audit");
  }
  try {
    await writeSnapshot(serialize(db), etag);
  } catch (error) {
    // Someone else wrote first; the re-read that follows picks up what they stored.
    if (!(error instanceof StaleSnapshotError)) throw error;
  }
}

/** Read back what is stored after a write `load()` made itself. */
async function reread(fallback: MockDb): Promise<Loaded> {
  const stored = await readSnapshot();
  if (!stored) {
    delete fallback.auditEvents;
    return { db: fallback };
  }
  const db = normalize(JSON.parse(stored.json) as MockDb);
  // The move above already dropped it; the next commit drops any copy that is still here.
  delete db.auditEvents;
  return { db, etag: stored.etag };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function load(): Promise<Loaded> {
  // `readSnapshot` answers `null` only when nothing is stored at all, and throws on a failed read.
  // Treating *any* failure as "nothing stored" is what used to make one transient error — a Blob
  // timeout, a half-written file read mid-write — rebuild the seed and write it over the entire
  // database. A snapshot that exists but will not parse is likewise a failure to report, not an
  // empty store to refill: the caller's action fails and can be retried, and no data is lost.
  const raw = await readSnapshot();
  if (raw) {
    const db = normalize(JSON.parse(raw.json) as MockDb);
    if (!db.auditEvents) return { db, etag: raw.etag };
    // A snapshot from before the audit log had its own snapshot: move it out, once.
    await moveAuditOut(db, raw.etag);
    return reread(db);
  }

  // Genuinely nothing stored yet. On disk-backed local dev, prefer whatever `.data/imgc-db.json`
  // already holds over generating fresh. On Blob, skip that entirely and always regenerate from
  // `buildSeed()`: `.data/` is gitignored, so it is never a deployment's real seed — it is one
  // developer's local scratch state. `vercel --prod` uploads the working directory as-is, so a
  // `.data/imgc-db.json` sitting on disk would otherwise ship with the bundle and be read back as
  // the "official" seed the moment the Blob store was empty.
  const bundled = USING_BLOB ? null : await readBundledSeed();
  let seeded: MockDb;
  if (bundled) {
    try {
      seeded = normalize(JSON.parse(bundled) as MockDb);
    } catch {
      seeded = buildSeed();
    }
  } else {
    seeded = buildSeed();
  }

  await moveAuditOut(seeded, undefined);
  // Re-read rather than assume: the write above may have lost a race with another instance
  // seeding at the same moment, and the stored copy is the one everyone else will now build on.
  return reread(seeded);
}

/* ── per-request read memo (outside a transaction) ─────────────────── */

/**
 * One load per request. A page render calls `readDb` from several services — the dashboard alone
 * made three or four whole-snapshot reads, each a network round trip on Blob. `cache` scopes this
 * box to the current request; outside a request it is simply a fresh box every time.
 */
const requestSnapshot = cache((): { current: Promise<Loaded> | null } => ({
  current: null,
}));

/** The same, for the audit log — read only by the screens that show it. */
const requestAudit = cache((): { current: Promise<AuditEvent[]> | null } => ({
  current: null,
}));

/* ── transactions (Server Actions) ─────────────────────────────────── */

interface Tx {
  db: MockDb;
  etag?: string;
  dirty: boolean;
  /** Log entries this action made, in order — written after the main commit lands. */
  audit: AuditEvent[];
}

const txStore = new AsyncLocalStorage<Tx>();
const TX_ATTEMPTS = 5;

/**
 * Run `fn` against one loaded snapshot and persist every change it makes in a single conditional
 * write.
 *
 * If another writer got in first (`StaleSnapshotError`), the whole of `fn` runs again on the newer
 * state — the same compose-don't-clobber rule `writeDb` applies to one mutation, applied to the
 * action as a unit. That means `fn` must be safe to run more than once, which the actions are: each
 * looks its target up in the database it is handed. The one side effect outside the snapshot is a
 * file upload, and a re-run only leaves an unreferenced copy of that file behind.
 *
 * A call made while a transaction is already running joins it rather than starting another.
 */
export async function withDbTransaction<T>(fn: () => Promise<T>): Promise<T> {
  if (txStore.getStore()) return fn();

  let lastError: unknown;
  for (let attempt = 0; attempt < TX_ATTEMPTS; attempt += 1) {
    const { db, etag } = await load();
    const tx: Tx = { db, etag, dirty: false, audit: [] };
    const result = await txStore.run(tx, fn);
    if (tx.dirty) {
      try {
        await commit(tx);
      } catch (error) {
        if (!(error instanceof StaleSnapshotError)) throw error;
        lastError = error;
        await sleep(120 * (attempt + 1));
        continue;
      }
      // Later reads in this same request — a page render that ran a transaction — see the commit.
      requestSnapshot().current = Promise.resolve({ db: tx.db });
    }
    // Only now, after the change itself is saved: a retried attempt starts with an empty list, so
    // nothing is logged twice.
    await flushAudit(tx.audit);
    return result;
  }
  throw lastError;
}

function commit(tx: Tx): Promise<void> {
  const run = queue.then(() => writeSnapshot(serialize(tx.db), tx.etag));
  // Keep the chain alive even if this commit fails.
  queue = run.catch(() => undefined);
  return run;
}

/* ── audit log ─────────────────────────────────────────────────────── */

/**
 * Add entries to the stored log. Appending never conflicts, so a lost race is simply redone on top
 * of the newer log rather than failing.
 */
function commitAudit(events: AuditEvent[]): Promise<void> {
  const run = queue.then(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt += 1) {
      const stored = await readSnapshot("audit");
      const current = stored ? (JSON.parse(stored.json) as AuditEvent[]) : [];
      // Newest first, the order the log has always been kept in.
      const next = [...events].reverse().concat(current);
      try {
        await writeSnapshot(JSON.stringify(next), stored?.etag, "audit");
        requestAudit().current = Promise.resolve(next);
        return;
      } catch (error) {
        if (!(error instanceof StaleSnapshotError)) throw error;
        lastError = error;
        await sleep(120 * (attempt + 1));
      }
    }
    throw lastError;
  });
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Write log entries after the change they describe has been saved. A failure here is reported,
 * not thrown: the change is already stored, and failing the action would invite the user to
 * repeat something that has in fact happened.
 */
async function flushAudit(events: AuditEvent[]): Promise<void> {
  if (events.length === 0) return;
  try {
    await commitAudit(events);
  } catch (error) {
    console.error(
      "[db] The change was saved but its audit entry was not.",
      error
    );
  }
}

/** Record one log entry — with the running action's commit, or straight away outside one. */
export async function appendAudit(event: AuditEvent): Promise<void> {
  const tx = txStore.getStore();
  if (tx) {
    tx.audit.push(event);
    return;
  }
  await flushAudit([event]);
}

/** The whole audit log, newest first. Read-only. */
export async function readAuditLog(): Promise<AuditEvent[]> {
  // A snapshot from before the split still holds the log; loading it moves the log out first.
  await readDb();

  const box = requestAudit();
  if (!box.current) {
    const pending = readSnapshot("audit").then((stored) =>
      stored ? (JSON.parse(stored.json) as AuditEvent[]) : []
    );
    box.current = pending;
    pending.catch(() => {
      if (box.current === pending) box.current = null;
    });
  }
  const log = await box.current;
  // Inside an action, include the entries it has made but not yet written.
  const pendingOwn = txStore.getStore()?.audit ?? [];
  return pendingOwn.length ? [...pendingOwn].reverse().concat(log) : log;
}

/* ── public API ────────────────────────────────────────────────────── */

/** A read-only snapshot of the database. Do not mutate the result — go through `writeDb`. */
export async function readDb(): Promise<MockDb> {
  const tx = txStore.getStore();
  if (tx) return tx.db;

  const box = requestSnapshot();
  if (!box.current) {
    const pending = load();
    box.current = pending;
    // A failed load must not stay cached for the rest of the request.
    pending.catch(() => {
      if (box.current === pending) box.current = null;
    });
  }
  return (await box.current).db;
}

/**
 * Apply `mutator` to the database and persist the result. The mutator may return a value, which
 * is passed back.
 *
 * Inside a transaction this only edits the transaction's copy; the single write happens when the
 * transaction commits.
 *
 * Outside one — a page render that writes (opening a claim workspace creates its draft), the
 * sign-in flow — it is its own read/modify/write: re-read inside a per-instance queue, mutated,
 * written conditionally on the version it read, and redone on newer state if someone else wrote
 * in between. The queue only serialises writes *within one instance*; the conditional write is what
 * keeps two instances from erasing each other. A mutator must therefore be safe to run more than
 * once, which they all are: each looks its target up in the `db` it is handed and edits that.
 */
const WRITE_ATTEMPTS = 5;

export async function writeDb<T>(
  mutator: (db: MockDb) => T | Promise<T>
): Promise<T> {
  const tx = txStore.getStore();
  if (tx) {
    const result = await mutator(tx.db);
    tx.dirty = true;
    return result;
  }

  const run = queue.then(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt += 1) {
      const { db, etag } = await load();
      const result = await mutator(db);
      try {
        await writeSnapshot(serialize(db), etag);
        // Later reads in this same request see the write rather than the pre-write snapshot.
        requestSnapshot().current = Promise.resolve({ db });
        return result;
      } catch (error) {
        if (!(error instanceof StaleSnapshotError)) throw error;
        lastError = error;
        // Someone wrote between our read and our write. Back off briefly — long enough for the
        // winning write to be readable — then redo the whole read/modify/write on top of it.
        await sleep(120 * (attempt + 1));
      }
    }
    throw lastError;
  });
  // Keep the chain alive even if this mutation throws.
  queue = run.catch(() => undefined);
  return run;
}

/** Test/dev helper — kept for callers; there is no cross-request cache to drop. */
export function resetDbCache(): void {
  // Intentionally empty: reads are memoised per request only.
}

export { USING_BLOB };
