import "server-only";

import { CLAIM_TYPES } from "@/config/claimConfig";
import { newId, nowIso } from "@/server/mock/ids";
import { readDb, writeDb } from "@/server/mock/db";
import type { AppSession } from "@/lib/auth/appSession";
import type { LenderDocumentRequirement } from "@/server/mock/types";

/**
 * "Lender Document Configuration" — IMGC's own admin page for which documents each lender's
 * INITIAL claims require, independent of the built-in default checklist in `claimConfig.ts`.
 *
 * A lender with no saved rows here is unaffected by any of this: `materialiseChecklist`
 * (claimFlow.server.ts) falls back to the default checklist exactly as it always has. Only a
 * lender IMGC has actually configured gets its own list, and only for *new* claims created after
 * the save — nothing here ever reaches into a claim already in progress.
 */

export type Outcome = Readonly<{ ok: boolean; error?: string }>;

export interface LenderDocConfigRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  description?: string;
  required: boolean;
  /** Whether this row is a saved override or just previewing the default checklist because the
   *  lender has none saved yet — the page shows the same thing either way, but Save always writes
   *  a real configuration rather than silently doing nothing on an unmodified default. */
  isDefault: boolean;
}

function requireImgc(session: AppSession): Outcome | null {
  if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };
  return null;
}

/** Every lender IMGC can configure — the same master list the rest of the app uses. */
export async function listLendersForConfig(
  session: AppSession
): Promise<{ id: string; name: string }[]> {
  if (session.role !== "IMGC") return [];
  const db = await readDb();
  return db.lenderOrgs
    .map((o) => ({ id: o.id, name: o.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * A lender's document configuration. If nothing has been saved for this lender yet, this returns
 * the default INITIAL checklist as a starting point (`isDefault: true` on every row) — so the
 * page always shows a real, editable list rather than an empty table for a lender nobody has
 * touched, and Save turns that preview into an actual saved configuration for the first time.
 */
export async function getLenderDocumentConfig(
  session: AppSession,
  lenderOrgId: string
): Promise<LenderDocConfigRow[]> {
  if (session.role !== "IMGC") return [];
  const db = await readDb();
  const saved = db.lenderDocumentRequirements
    .filter((r) => r.lenderOrgId === lenderOrgId)
    .sort((a, b) => a.order - b.order);
  if (saved.length > 0) {
    return saved.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      category: r.category,
      description: r.description,
      required: r.required,
      isDefault: false,
    }));
  }
  return CLAIM_TYPES.INITIAL.documents.map((d) => ({
    id: `default_${d.slug}`,
    slug: d.slug,
    name: d.name,
    category: d.category,
    description: d.description,
    required: d.required,
    isDefault: true,
  }));
}

/**
 * Replaces a lender's entire saved configuration in one write — the page edits a local list
 * (add / remove / toggle Mandatory-Optional) and this is what "Save Configuration" commits, so
 * there is one moment a lender's list can disagree with what was last saved, not one per row.
 */
export async function saveLenderDocumentConfig(
  session: AppSession,
  lenderOrgId: string,
  rows: ReadonlyArray<{
    slug?: string;
    name: string;
    description?: string;
    required: boolean;
  }>
): Promise<Outcome> {
  const denied = requireImgc(session);
  if (denied) return denied;

  const db = await readDb();
  if (!db.lenderOrgs.some((o) => o.id === lenderOrgId)) {
    return { ok: false, error: "Lender not found." };
  }
  if (rows.length === 0) {
    return {
      ok: false,
      error: "A lender needs at least one document configured.",
    };
  }

  const seenNames = new Set<string>();
  for (const row of rows) {
    const key = row.name.trim().toLowerCase();
    if (!key) return { ok: false, error: "Every document needs a name." };
    if (seenNames.has(key)) {
      return { ok: false, error: `"${row.name.trim()}" is listed more than once.` };
    }
    seenNames.add(key);
  }

  const defaultBySlug = new Map(
    CLAIM_TYPES.INITIAL.documents.map((d) => [d.slug, d])
  );

  await writeDb((fresh) => {
    fresh.lenderDocumentRequirements = fresh.lenderDocumentRequirements.filter(
      (r) => r.lenderOrgId !== lenderOrgId
    );
    const created = nowIso();
    rows.forEach((row, i) => {
      const name = row.name.trim();
      // A row carried over from the default checklist keeps its slug and category, so a new
      // claim's pre-loaded demo files (matched by slug in materialiseChecklist) still land
      // correctly and it still groups under its usual heading. A document IMGC invented for this
      // lender gets a slug of its own, derived from its name, and a generic category.
      const known = row.slug ? defaultBySlug.get(row.slug) : undefined;
      const requirement: LenderDocumentRequirement = {
        id: newId("ldr"),
        lenderOrgId,
        slug: known?.slug ?? row.slug ?? slugify(name),
        name,
        category: known?.category ?? "Custom Document",
        description: row.description?.trim() || known?.description,
        required: row.required,
        order: i,
        createdAt: created,
      };
      fresh.lenderDocumentRequirements.push(requirement);
    });
  });

  return { ok: true };
}

function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `doc-${newId()}`;
}
