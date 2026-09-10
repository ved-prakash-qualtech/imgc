import "server-only";

/* eslint-disable security/detect-non-literal-fs-filename -- every filesystem path here is built
   from `process.cwd()` plus fixed literal segments, or from ids this server generated itself
   (`newId(...)`), never from request input. */
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Where the prototype's state actually lives.
 *
 * Two backends behind one seam:
 *
 * - **Filesystem** (local dev): the JSON snapshot under `.data/`, uploads under `.data/uploads/`.
 *   One process, one disk — exactly as before, no cloud account needed to run `pnpm dev`.
 * - **Vercel Blob** (any Vercel-hosted environment — Production, Preview, or `vercel dev`): one
 *   shared object store every serverless instance reads and writes.
 *
 * The filesystem cannot work on Vercel, and not because writes fail — they succeed. Each Lambda
 * instance has its own `/tmp`, so a claim submitted on one instance is invisible to the next
 * request, which is very likely served by a different instance (production logs showed 42 writes
 * spread over 9 instances across two regions, with only 3 of 28 read-after-writes landing back on
 * the instance that did the write). The symptom is not an error — it is a 200 whose effect then
 * disappears.
 *
 * The switch is gated on *running on Vercel*, not merely on the token being present: `vercel link`
 * writes `BLOB_READ_WRITE_TOKEN` into `.env.local` for local convenience (so `vercel dev` and blob
 * CLI commands work), and Next.js loads `.env.local` for plain `pnpm dev` too. Keying off the token
 * alone would make an ordinary local dev session read and write the same live store the deployed
 * demo uses — a local test upload would appear in front of whoever is looking at the real URL.
 * Gating on `IS_SERVERLESS` keeps `pnpm dev` on its own disk regardless of what's in `.env.local`,
 * while every Vercel-hosted environment (which also sets this) still gets the shared store.
 */

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const IS_SERVERLESS = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
);

/** Blob is used only on a Vercel-hosted environment with a store connected; plain local
 *  development always uses the disk, even if a token happens to be sitting in `.env.local`. */
export const USING_BLOB = Boolean(BLOB_TOKEN) && IS_SERVERLESS;

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "imgc-db.json");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

/** Fixed key for the snapshot — one document, overwritten in place, never suffixed. */
const DB_BLOB_KEY = "imgc/db.json";
const UPLOAD_PREFIX = "imgc/uploads";

/* ── snapshot ──────────────────────────────────────────────────────── */

/** The bundled seed that ships with the deployment. Read-only, and only ever a fallback. */
export async function readBundledSeed(): Promise<string | null> {
  try {
    return await fs.readFile(DB_FILE, "utf8");
  } catch {
    return null;
  }
}

/**
 * The DB snapshot is stored *private*, not public — the only reader is this server, so there is
 * no reason to hand it a public CDN URL. That distinction turns out to matter for correctness,
 * not just access control: a public blob's URL is served through Vercel's CDN, and a fresh
 * `fetch(url, { cache: "no-store" })` to that URL only guarantees *this runtime* won't reuse a
 * cached response — it says nothing about whether the CDN edge that actually answers has caught
 * up with the last `put()` yet. Reproduced live, twice, with two different mitigations already
 * tried (routing around `list()`, then a same-instance read-your-own-writes cache): one IMGC
 * action's write (an approval) was silently gone a few seconds later when a second action (a
 * rejection) on the same account, landing on a different instance, read the snapshot back — the
 * fetched content simply hadn't caught up. A controlled test nailed the timing: the same two
 * actions 20 seconds apart both persisted; a few seconds apart, the first was lost.
 *
 * `@vercel/blob`'s `get()` with `useCache: false` is Vercel's own documented answer to exactly
 * this: it reads the object from origin storage rather than through the CDN, so there is no edge
 * cache that might not have caught up. (`access` here must match the *store's* mode — this store
 * is public, and asking for `"private"` on a public store is a hard error, not a stricter read.)
 *
 * That still isn't sufficient on its own, so it is paired with `ownWrite` below. Origin reads
 * turn out to lag their own write closely enough that a claim created and read back inside a
 * single request could come back missing — which surfaced as an eligible account rendering "not
 * eligible for a claim yet", because the auto-created draft was invisible one line later.
 */

/**
 * Read-your-own-writes cache, this instance only.
 *
 * A single user action often chains several `writeDb` calls — `decideDocument` alone does its own
 * mutation, then `recordEvent`, then `syncQueryForDocumentDecision`, then a mailer write: four
 * full read/modify/writes of the one JSON blob, sequential and awaited, each re-reading the
 * snapshot before mutating it. If any of those reads misses the write just before it, that write
 * is silently erased by the copy written on top of it.
 *
 * So: trust what this instance just wrote, for a few seconds, rather than asking the store to
 * confirm it. Durability is unchanged — `writeSnapshot` still puts to Blob every time — this only
 * skips a remote read whose answer we already know. What it cannot cover is two *different*
 * instances writing within the same few seconds; that window is the same one `db.ts` documents
 * and accepts for its write queue, and the `useCache: false` origin read above is what keeps it
 * as small as this store allows.
 */
let ownWrite: { json: string; etag: string; at: number } | null = null;
const OWN_WRITE_TTL_MS = 10_000;

/** What a read hands back: the snapshot, plus the version tag a write must quote to be accepted. */
export interface Snapshot {
  json: string;
  /** `undefined` when nothing is stored yet — the first write has no version to match against. */
  etag?: string;
}

/**
 * Thrown when a write quoted a version that is no longer current — someone else wrote first.
 * `writeDb` catches this, re-reads, and re-applies the mutation to the newer state.
 */
export class StaleSnapshotError extends Error {
  constructor() {
    super("Snapshot changed underneath this write.");
    this.name = "StaleSnapshotError";
  }
}

/**
 * `get()` hands back a *weak* validator (`W/"abc"`); `put({ ifMatch })` only accepts the strong
 * form (`"abc"`) and rejects anything else as a mismatch. Without this the conditional write can
 * never succeed — every attempt fails its precondition against an ETag that is, byte for byte,
 * the one currently stored. That failure mode is indistinguishable from real contention, which is
 * exactly how it presented: five retries, five "someone else wrote first", on an idle store.
 */
function strongEtag(etag: string): string {
  return etag.replace(/^W\//, "");
}

export async function readSnapshot(): Promise<Snapshot | null> {
  if (!USING_BLOB) {
    try {
      return { json: await fs.readFile(DB_FILE, "utf8") };
    } catch {
      return null;
    }
  }

  if (ownWrite && Date.now() - ownWrite.at < OWN_WRITE_TTL_MS) {
    return { json: ownWrite.json, etag: ownWrite.etag };
  }

  const { get } = await import("@vercel/blob");
  const result = await get(DB_BLOB_KEY, {
    access: "public",
    useCache: false,
    token: BLOB_TOKEN,
  }).catch(() => null);
  if (!result || result.statusCode !== 200) return null;
  return {
    json: await new Response(result.stream).text(),
    etag: strongEtag(result.blob.etag),
  };
}

/**
 * Persist the snapshot, but only if the stored version is still the one the caller read.
 *
 * This is the part that makes concurrent writes safe rather than merely unlikely. Everything
 * before it — origin reads, the own-write cache — narrows the window in which an instance reads
 * a snapshot that is already out of date; none of them close it, because a second instance can
 * always write in between. Quoting the ETag turns that from silent data loss into a
 * `StaleSnapshotError` the caller can act on: `writeDb` re-reads and re-applies the mutation to
 * the newer state, so the two writes compose instead of one erasing the other.
 *
 * This is what a real database's transaction would give for free; a single JSON blob has to say
 * it out loud.
 */
export async function writeSnapshot(
  json: string,
  ifMatch?: string
): Promise<void> {
  if (!USING_BLOB) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DB_FILE, json, "utf8");
    return;
  }

  const { put, BlobPreconditionFailedError } = await import("@vercel/blob");
  try {
    const result = await put(DB_BLOB_KEY, json, {
      access: "public",
      token: BLOB_TOKEN,
      contentType: "application/json",
      // A stable key that is replaced in place: the snapshot has one address, not one per write.
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
      ...(ifMatch ? { ifMatch } : {}),
    });
    ownWrite = { json, etag: strongEtag(result.etag), at: Date.now() };
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) {
      // Our copy is behind. Drop it so the retry's read cannot be served from this cache.
      ownWrite = null;
      throw new StaleSnapshotError();
    }
    throw error;
  }
}

/* ── uploaded documents ────────────────────────────────────────────── */

/**
 * Store one uploaded file and return the locator to persist as `DocumentFile.storedPath`.
 *
 * On Blob that locator is the file's URL; on disk it stays an absolute path, so rows written by
 * earlier local runs keep resolving (see `readUpload`).
 */
export async function putUpload(
  accountId: string,
  fileName: string,
  bytes: Buffer,
  contentType: string
): Promise<string> {
  if (!USING_BLOB) {
    const dir = path.join(UPLOAD_DIR, accountId);
    const stored = path.join(dir, fileName);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(stored, bytes);
    return stored;
  }

  const { put } = await import("@vercel/blob");
  const { url } = await put(`${UPLOAD_PREFIX}/${accountId}/${fileName}`, bytes, {
    access: "public",
    token: BLOB_TOKEN,
    contentType,
    // The caller already made the name unique with the file's own id.
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return url;
}

/** Marks the two Initial-Claim demo PDFs seeded from `public/demo/` (see `materialiseChecklist` in
 *  claimFlow.server.ts) — the only `storedPath`s that were ever a path under `public/` rather than
 *  a real upload. */
const PUBLIC_DIR_MARKER = `${path.sep}public${path.sep}`;

/** Read a stored file back, whichever backend wrote it. `null` when it is no longer there. */
export async function readUpload(storedPath: string): Promise<Buffer | null> {
  if (!storedPath) return null;

  // A URL means Blob wrote it — true even for a row created before this instance started, and
  // true regardless of which backend is active now.
  if (/^https?:\/\//.test(storedPath)) {
    const res = await fetch(`${storedPath}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }

  try {
    return await fs.readFile(storedPath);
  } catch {
    // `fs.readFile` on an absolute `public/…` path works locally (it's just a file on disk) but
    // not reliably on Vercel: `public/` is served by Vercel's own static layer, not guaranteed to
    // sit on the function's local filesystem at the source path. Vercel always serves `public/` at
    // the site root, though, so the same asset is reachable over HTTP — which is what the two
    // pre-seeded Initial Claim demo PDFs need in order to stay viewable on a deployment.
    const marker = storedPath.indexOf(PUBLIC_DIR_MARKER);
    if (marker === -1) return null;
    const publicPath = storedPath.slice(marker + PUBLIC_DIR_MARKER.length).split(path.sep).join("/");

    // `storedPath` was built from the `process.cwd()` of whichever machine wrote the row, which on
    // a deployment is not the `process.cwd()` doing the reading. Try the same asset where this
    // runtime could actually be keeping it before giving up on the filesystem.
    const candidates = [
      path.join(process.cwd(), "public", ...publicPath.split("/")),
      path.join(process.cwd(), ".next", "standalone", "public", ...publicPath.split("/")),
      path.join("/var/task", "public", ...publicPath.split("/")),
    ];
    for (const candidate of candidates) {
      try {
        return await fs.readFile(candidate);
      } catch {
        /* try the next one */
      }
    }
    const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
    try {
      const res = await fetch(`${base}/${publicPath}`, { cache: "no-store" });
      if (!res.ok) return null;
      const bytes = Buffer.from(await res.arrayBuffer());
      // This request carries no session, so the app's own middleware answers it with the login
      // page — HTTP 200, HTML body. Serving that back as the document's `mime` produced a file
      // that claimed to be a PDF and was not, which a viewer can only report as a broken
      // document. A file is only a file if it looks like one.
      return bytes.subarray(0, 5).toString("latin1") === "%PDF-" ? bytes : null;
    } catch {
      return null;
    }
  }
}
