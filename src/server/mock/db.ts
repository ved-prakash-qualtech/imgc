import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import type { MockDb } from "@/server/mock/types";
import { buildSeed } from "@/server/mock/seed";

/**
 * Prototype persistence: the whole domain in one JSON file under `.data/`, plus uploaded files
 * under `.data/uploads/`. Single process, no concurrency guarantees beyond the in-process write
 * queue below — deliberately simple, and the seam a real build replaces with QCP services.
 */

const DATA_DIR = path.join(process.cwd(), ".data");
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
  if (cache) return cache;
  await ensureDirs();
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    cache = JSON.parse(raw) as MockDb;
  } catch {
    cache = buildSeed();
    await fs.writeFile(DB_FILE, JSON.stringify(cache, null, 2), "utf8");
  }
  return cache;
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
export async function writeDb<T>(mutator: (db: MockDb) => T | Promise<T>): Promise<T> {
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
