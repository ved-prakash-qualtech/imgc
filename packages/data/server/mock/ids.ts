import { v4 as uuid } from "uuid";

/** Opaque id for a mock-DB row. */
export function newId(prefix = "id"): string {
  return `${prefix}_${uuid()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
