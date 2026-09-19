import "server-only";

/* eslint-disable security/detect-non-literal-fs-filename -- every filesystem path here is built
   from `process.cwd()` plus fixed literal segments, or from ids this server generated itself
   (`newId(...)`), never from request input. */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  ACCEPTED_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  UPLOAD_PATH_PREFIX,
} from "@/constants/uploads";

/**
 * No storage call may wait forever. A request that never settles holds `db.ts`'s per-process
 * write queue, and every later write on that process waits behind it — on a long-lived dev server,
 * for the rest of the session. A timeout turns that into one failed action instead.
 */
const SNAPSHOT_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 60_000;

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

/*
 * The snapshots (not the uploads) live in Postgres wherever one is connected.
 *
 * Blob turned out not to be read-after-write consistent for an overwritten object: measured on the
 * live store, 11 of 15 reads straight after a write returned the previous version, and some were
 * still stale 15 seconds later. With every request reading the whole database, that meant screens
 * drawn from an old copy (a deleted document reappearing, "Document not found" right after an
 * upload) and saves failing their version check five times in a row with nobody else using the app.
 * Postgres always answers with the latest committed row, and `UPDATE … WHERE version = $n` is the
 * same compare-and-set the Blob ETag was meant to be.
 *
 * Uploaded files stay in Blob: each is written once under a unique name and never overwritten, so
 * they never had this problem.
 *
 * Local development keeps the disk unless SNAPSHOT_STORE=postgres is set, and even then it uses its
 * own rows (`local:db`, `local:audit`, or SNAPSHOT_NAMESPACE) so a local test can never write over
 * the rows the live site reads.
 */
const DATABASE_URL = process.env.DATABASE_URL;
export const USING_POSTGRES =
  Boolean(DATABASE_URL) &&
  (IS_SERVERLESS || process.env.SNAPSHOT_STORE === "postgres");

type Sql = ReturnType<typeof import("@neondatabase/serverless").neon>;
let sqlClient: Sql | null = null;

async function pg(): Promise<Sql> {
  if (!sqlClient) {
    const { neon } = await import("@neondatabase/serverless");
    sqlClient = neon(DATABASE_URL!);
  }
  return sqlClient;
}

/**
 * Which row this deployment's data lives in.
 *
 * Several deployments can share one Neon database — the frozen demo and a working copy beside it
 * — so each keeps its own rows: `SNAPSHOT_NAMESPACE` prefixes them. A deployment without one uses
 * the bare `db`/`audit` rows, which is exactly what the original deployment has always used, so
 * setting a namespace on a new project can never reach into the old one's data.
 */
function rowName(name: SnapshotName): string {
  const namespace = process.env.SNAPSHOT_NAMESPACE;
  if (IS_SERVERLESS) return namespace ? `${namespace}:${name}` : name;
  return `${namespace || "local"}:${name}`;
}

const pgTimeout = () => ({
  fetchOptions: { signal: AbortSignal.timeout(SNAPSHOT_TIMEOUT_MS) },
});

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "imgc-db.json");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

/** Fixed key for the snapshot — one document, overwritten in place, never suffixed. */
const DB_BLOB_KEY = "imgc/db.json";
const UPLOAD_PREFIX = UPLOAD_PATH_PREFIX;

/**
 * The activity log is its own snapshot. It only ever grows and only the audit screens read it, so
 * keeping it inside the main snapshot made every page load and every save carry the whole history.
 */
const AUDIT_FILE = path.join(DATA_DIR, "imgc-audit.json");
const AUDIT_BLOB_KEY = "imgc/audit.json";

/** Which stored snapshot: `db` is the domain, `audit` the activity log. */
export type SnapshotName = "db" | "audit";

function fileFor(name: SnapshotName): string {
  return name === "audit" ? AUDIT_FILE : DB_FILE;
}

function keyFor(name: SnapshotName): string {
  return name === "audit" ? AUDIT_BLOB_KEY : DB_BLOB_KEY;
}

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
const ownWrites = new Map<
  SnapshotName,
  { json: string; etag: string; at: number }
>();
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

/** Version tag for the disk snapshot — the local equivalent of Blob's ETag. */
function contentTag(json: string): string {
  return createHash("sha1").update(json).digest("hex");
}

/**
 * Read the stored snapshot.
 *
 * `null` means one thing only: nothing has ever been stored. Every other failure — a timeout, a
 * 5xx, an unreadable file — throws. The difference matters because `db.ts` answers `null` by
 * seeding a fresh database and writing it; answering a transient error the same way, as this used
 * to (`.catch(() => null)` on Blob, a bare `catch` on disk), replaced the whole live database with
 * the demo seed.
 */
export async function readSnapshot(
  name: SnapshotName = "db"
): Promise<Snapshot | null> {
  if (USING_POSTGRES) {
    const sql = await pg();
    const rows = (await sql.query(
      "SELECT data, version FROM imgc_snapshots WHERE name = $1",
      [rowName(name)],
      pgTimeout()
    )) as { data: string; version: string | number }[];
    const row = rows[0];
    return row ? { json: row.data, etag: String(row.version) } : null;
  }

  if (!USING_BLOB) {
    let json: string;
    try {
      json = await fs.readFile(fileFor(name), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
    return { json, etag: contentTag(json) };
  }

  const own = ownWrites.get(name);
  if (own && Date.now() - own.at < OWN_WRITE_TTL_MS) {
    return { json: own.json, etag: own.etag };
  }

  const { get, BlobNotFoundError } = await import("@vercel/blob");
  let result: Awaited<ReturnType<typeof get>>;
  try {
    result = await get(keyFor(name), {
      access: "public",
      useCache: false,
      token: BLOB_TOKEN,
      abortSignal: AbortSignal.timeout(SNAPSHOT_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    throw error;
  }
  if (!result) return null;
  if (result.statusCode !== 200) {
    throw new Error(`Snapshot read returned status ${result.statusCode}.`);
  }
  return {
    json: await new Response(result.stream).text(),
    etag: strongEtag(result.blob.etag),
  };
}

/**
 * Replace the disk snapshot atomically: write a temporary file, then rename it over the real one.
 * Writing the real file in place empties it first, and any request reading during that window got
 * a truncated file. Windows can refuse the rename for a moment while a reader holds the file open,
 * so that one case is retried.
 */
async function writeFileAtomic(target: string, json: string): Promise<void> {
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temp, json, "utf8");
  for (let attempt = 0; ; attempt += 1) {
    try {
      await fs.rename(temp, target);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      const busy = code === "EPERM" || code === "EBUSY" || code === "EACCES";
      if (!busy || attempt >= 5) {
        await fs.rm(temp, { force: true }).catch(() => undefined);
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
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
  ifMatch?: string,
  name: SnapshotName = "db"
): Promise<void> {
  const file = fileFor(name);
  if (USING_POSTGRES) {
    const sql = await pg();
    if (ifMatch) {
      // Accepted only if nobody has saved since `ifMatch` was read; otherwise no row matches.
      const rows = (await sql.query(
        "UPDATE imgc_snapshots SET data = $1, version = version + 1, updated_at = now() WHERE name = $2 AND version = $3 RETURNING version",
        [json, rowName(name), ifMatch],
        pgTimeout()
      )) as unknown[];
      if (rows.length === 0) throw new StaleSnapshotError();
      return;
    }
    // No version quoted: the first write of this snapshot (seeding, or the audit log's first
    // entry). Same unconditional behaviour the disk and Blob paths have for that case.
    await sql.query(
      "INSERT INTO imgc_snapshots (name, data, version) VALUES ($1, $2, 1) ON CONFLICT (name) DO UPDATE SET data = EXCLUDED.data, version = imgc_snapshots.version + 1, updated_at = now()",
      [rowName(name), json],
      pgTimeout()
    );
    return;
  }

  if (!USING_BLOB) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    // Same compare-then-write rule as Blob's ETag, so a local write also refuses to erase a change
    // it never saw. Every disk write runs inside `db.ts`'s per-process queue, which is what keeps
    // this check and the write below from interleaving with another write.
    if (ifMatch) {
      let current: string | null = null;
      try {
        current = contentTag(await fs.readFile(file, "utf8"));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      if (current !== ifMatch) throw new StaleSnapshotError();
    }
    await writeFileAtomic(file, json);
    return;
  }

  const { put, BlobPreconditionFailedError } = await import("@vercel/blob");
  try {
    const result = await put(keyFor(name), json, {
      access: "public",
      token: BLOB_TOKEN,
      contentType: "application/json",
      // A stable key that is replaced in place: the snapshot has one address, not one per write.
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
      abortSignal: AbortSignal.timeout(SNAPSHOT_TIMEOUT_MS),
      ...(ifMatch ? { ifMatch } : {}),
    });
    ownWrites.set(name, {
      json,
      etag: strongEtag(result.etag),
      at: Date.now(),
    });
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) {
      // Our copy is behind. Drop it so the retry's read cannot be served from this cache.
      ownWrites.delete(name);
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
  const { url } = await put(
    `${UPLOAD_PREFIX}/${accountId}/${fileName}`,
    bytes,
    {
      access: "public",
      token: BLOB_TOKEN,
      contentType,
      // The caller already made the name unique with the file's own id.
      addRandomSuffix: false,
      allowOverwrite: true,
      abortSignal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    }
  );
  return url;
}

/** A document an upload action received — its bytes (local development), or the address the
 *  browser already uploaded it to (a deployment; see `attachUpload`). */
export type IncomingUpload = File | { url: string; name: string };

/** A stored document, as a `DocumentFile` row records it. */
export interface StoredUpload {
  storedPath: string;
  originalName: string;
  size: number;
  mime: string;
}

export type StoreUploadResult =
  { ok: true; file: StoredUpload } | { ok: false; error: string };

/**
 * Store an incoming document and describe it for its `DocumentFile` row. File bytes are written
 * with `putUpload`; a browser-uploaded file is checked before it is accepted (`resolveDirectUpload`).
 */
export async function storeIncomingUpload(
  accountId: string,
  fileId: string,
  incoming: IncomingUpload
): Promise<StoreUploadResult> {
  if (!(incoming instanceof File)) {
    return resolveDirectUpload(accountId, incoming);
  }
  if (incoming.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `That file is larger than ${MAX_UPLOAD_LABEL}.`,
    };
  }
  const mime = incoming.type || "application/octet-stream";
  const safeName = incoming.name.replace(/[^\w.\-]+/g, "_").slice(-120);
  const storedPath = await putUpload(
    accountId,
    `${fileId}__${safeName}`,
    Buffer.from(await incoming.arrayBuffer()),
    mime
  );
  return {
    ok: true,
    file: {
      storedPath,
      originalName: incoming.name,
      size: incoming.size,
      mime,
    },
  };
}

/**
 * Accept a file the browser uploaded straight to Blob — but only after confirming it is really
 * one of ours. The address must be in this store (`head` with our token fails for anyone else's)
 * and under the account's own folder, and its size and type are read back from Blob rather than
 * taken from the browser's word.
 */
async function resolveDirectUpload(
  accountId: string,
  incoming: { url: string; name: string }
): Promise<StoreUploadResult> {
  let url: URL;
  try {
    url = new URL(incoming.url);
  } catch {
    return { ok: false, error: "That upload could not be found." };
  }
  const inAccountFolder =
    url.protocol === "https:" &&
    url.hostname.endsWith(".public.blob.vercel-storage.com") &&
    url.pathname.startsWith(`/${UPLOAD_PREFIX}/${accountId}/`);
  if (!USING_BLOB || !inAccountFolder) {
    return { ok: false, error: "That upload could not be verified." };
  }

  const storedPath = `${url.origin}${url.pathname}`;
  const { head } = await import("@vercel/blob");
  const meta = await head(storedPath, {
    token: BLOB_TOKEN,
    abortSignal: AbortSignal.timeout(SNAPSHOT_TIMEOUT_MS),
  });
  if (meta.size === 0) return { ok: false, error: "That file is empty." };
  if (meta.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `That file is larger than ${MAX_UPLOAD_LABEL}.`,
    };
  }
  if (
    !(ACCEPTED_UPLOAD_TYPES as readonly string[]).includes(meta.contentType)
  ) {
    return {
      ok: false,
      error: "Only PDF, JPG, PNG or WEBP files are accepted.",
    };
  }
  const fallbackName = decodeURIComponent(url.pathname.split("/").pop() ?? "");
  return {
    ok: true,
    file: {
      storedPath,
      originalName: incoming.name.trim().slice(0, 200) || fallbackName || "document",
      size: meta.size,
      mime: meta.contentType,
    },
  };
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
    const res = await fetch(`${storedPath}?t=${Date.now()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(SNAPSHOT_TIMEOUT_MS),
    });
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
      const res = await fetch(`${base}/${publicPath}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(SNAPSHOT_TIMEOUT_MS),
      });
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
