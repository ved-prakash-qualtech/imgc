import "server-only";

/* eslint-disable security/detect-non-literal-fs-filename -- every path here is built from
   `process.cwd()`/"/tmp" plus fixed literal segments (see DATA_DIR/DB_FILE/SEED_FILE below), never
   from request input; the env-conditional branch for the serverless data dir is enough to defeat
   the lint rule's literal-tracking, not an actual path-injection risk. */
import { promises as fs } from "node:fs";
import path from "node:path";

import type { MockDb } from "@/server/mock/types";
import { buildSeed } from "@/server/mock/seed";

/**
 * Prototype persistence: the whole domain in one JSON file under `.data/`, plus uploaded files
 * under `.data/uploads/`. Single process, no concurrency guarantees beyond the in-process write
 * queue below — deliberately simple, and the seam a real build replaces with QCP services.
 *
 * Serverless note: on Vercel (and Lambda generally) the deployed bundle — `process.cwd()`,
 * where `.data/imgc-db.json` ships checked into the repo — is a read-only filesystem. A plain
 * `readFile` against it succeeds (that's why every page that only *reads* — Dashboard, All Loans,
 * Claims — works fine once deployed), but `fs.writeFile` on it throws `EROFS`, which is exactly
 * what "Initiate Claim" hits the moment it calls `writeDb` to persist a new claim: the crash is
 * real, not flaky, and only ever shows up on a write path. `/tmp` is the one directory Vercel's
 * functions can actually write to, so that's where every write goes instead — reads still fall
 * back to the bundled seed the first time. `/tmp` is itself ephemeral (wiped on cold start, and
 * not shared across concurrent instances), so this stops the crash and makes demo writes work
 * within a warm instance, but it is not durable storage: a real deployment needs this file swapped
 * for an actual database, same as the other stand-ins this template documents.
 */
const IS_SERVERLESS = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
);
const SEED_DIR = path.join(process.cwd(), ".data");
const SEED_FILE = path.join(SEED_DIR, "imgc-db.json");
const DATA_DIR = IS_SERVERLESS ? path.join("/tmp", "imgc-data") : SEED_DIR;
const DB_FILE = path.join(DATA_DIR, "imgc-db.json");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

let cache: MockDb | null = null;
/** Serialises writes so two overlapping mutations cannot clobber each other's snapshot. */
let queue: Promise<unknown> = Promise.resolve();

async function ensureDirs(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

async function load(): Promise<MockDb> {
  // if (cache) return cache; // Removed to prevent stale reads across Next.js module boundaries
  await ensureDirs();
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    cache = JSON.parse(raw) as MockDb;
    return cache;
  } catch {
    // No writable copy yet. On serverless, prefer copying the bundled seed (read-only but always
    // present) over rebuilding from scratch, so a first write doesn't reset demo data that was
    // already checked in — falls back to `buildSeed()` only if even that bundled file is missing.
    try {
      const seedRaw = await fs.readFile(SEED_FILE, "utf8");
      cache = JSON.parse(seedRaw) as MockDb;
    } catch {
      cache = buildSeed();
    }
    await fs.writeFile(DB_FILE, JSON.stringify(cache, null, 2), "utf8");
    return cache;
  }
}

async function persist(db: MockDb): Promise<void> {
  await ensureDirs();
  cache = db;
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

/** A read-only snapshot of the database. Do not mutate the result — go through `writeDb`. */
export async function readDb(): Promise<MockDb> {
  const db = await load();
  return db;
}

/**
 * Apply `mutator` to the database and persist the result. Mutations are queued, so callers can
 * `await writeDb(...)` without racing. The mutator may return a value, which is passed back.
 */
export async function writeDb<T>(
  mutator: (db: MockDb) => T | Promise<T>
): Promise<T> {
  const run = queue.then(async () => {
    const db = await load();
    const result = await mutator(db);
    await persist(db);
    return result;
  });
  // Keep the chain alive even if this mutation throws.
  queue = run.catch(() => undefined);
  return run;
}

/** Test/dev helper — drop the in-memory cache so the next read reloads from disk. */
export function resetDbCache(): void {
  cache = null;
}
