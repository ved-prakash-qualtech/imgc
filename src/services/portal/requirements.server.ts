import "server-only";

import { readDb } from "@/server/mock/db";
import { isActive } from "@/services/portal/claims.server";
import type { AppSession } from "@/lib/auth/appSession";
import type {
  ClaimDocument,
  DocStatus,
  DocumentFile,
} from "@/server/mock/types";

/**
 * The cross-case view of additional document requirements.
 *
 * Both the IMGC "Additional Documents" table and the lender's "Required Documents" page read
 * through here, so the two screens can never disagree about a document's state — there is one
 * query, one scoping rule, and one shape.
 */

export interface RequirementRow {
  id: string;
  accountId: string;
  caseId: string;
  customerName: string;
  lenderOrgId: string;
  lenderName: string;
  product: string;
  region: string;
  branch: string;
  assignedUserName: string;
  applicationDate: string;

  name: string;
  category: string;
  description: string;
  required: boolean;
  status: DocStatus;
  priority: string;
  dueDate?: string;
  active: boolean;
  addedBy: ClaimDocument["addedBy"];
  addedByName: string;
  addedOn: string;
  requirementRemarks?: string;

  version: number;
  file?: DocumentFile;
  /** All live (non-superseded) files — one for single categories, many for multi. */
  files: DocumentFile[];
  history: DocumentFile[];

  /* ── configuration-driven claim document category ── */
  slug?: string;
  multiple: boolean;
  conditional: boolean;
  conditionReason?: string;
  /** Display reference for a lender-added additional document (AD-001). */
  refNo?: string;
  review?: ClaimDocument["review"];
  /** The remark the lender most recently needs to act on, whichever side wrote it. */
  latestRemark: string;
}

function toRow(
  doc: ClaimDocument,
  db: Awaited<ReturnType<typeof readDb>>
): RequirementRow {
  const account = db.accounts.find((a) => a.id === doc.accountId);
  const org = db.lenderOrgs.find((o) => o.id === account?.lenderOrgId);
  const history = db.documentFiles
    .filter((f) => f.documentId === doc.id)
    .sort((a, b) => b.version - a.version);

  return {
    id: doc.id,
    accountId: doc.accountId,
    caseId: account?.loanNo ?? "—",
    customerName: account?.borrowerName ?? "—",
    lenderOrgId: account?.lenderOrgId ?? "",
    lenderName: org?.name ?? "—",
    product: account?.product ?? "—",
    region: account?.region ?? "—",
    branch: account?.branch ?? "—",
    assignedUserName: account?.assignedUserName ?? "—",
    applicationDate: account?.applicationDate ?? doc.createdAt,

    name: doc.name,
    category: doc.category ?? "—",
    description: doc.description ?? "",
    required: doc.required,
    status: doc.status,
    priority: doc.priority ?? "NORMAL",
    dueDate: doc.dueDate,
    active: isActive(doc),
    addedBy: doc.addedBy,
    addedByName: doc.addedByName ?? (doc.addedBy === "SYSTEM" ? "System" : "IMGC"),
    addedOn: doc.createdAt,
    requirementRemarks: doc.requirementRemarks,

    version: doc.version ?? 0,
    file: history.find((f) => f.id === doc.currentFileId),
    files: history.filter((f) => !f.supersededAt),
    history,
    slug: doc.slug,
    multiple: doc.multiple ?? false,
    conditional: doc.conditional ?? false,
    conditionReason: doc.conditionReason,
    refNo: doc.refNo,
    review: doc.review,
    latestRemark:
      doc.review?.remarks ||
      history.find((f) => f.id === doc.currentFileId)?.uploadRemarks ||
      "",
  };
}

/**
 * Every additional-document requirement the caller may see.
 *
 * Scoping is the same rule the rest of the portal uses: IMGC sees every case, a lender sees only
 * the cases belonging to their organisation, and a withdrawn requirement is invisible to them.
 */
export async function listRequirements(
  session: AppSession
): Promise<RequirementRow[]> {
  const db = await readDb();
  const visibleAccounts = new Set(
    db.accounts
      .filter(
        (a) => session.role === "IMGC" || a.lenderOrgId === session.lenderOrgId
      )
      .map((a) => a.id)
  );

  return db.claimDocuments
    .filter((d) => d.addedBy === "IMGC" && visibleAccounts.has(d.accountId))
    .filter((d) => session.role === "IMGC" || isActive(d))
    .map((d) => toRow(d, db))
    .sort(
      (a, b) =>
        a.caseId.localeCompare(b.caseId) || a.name.localeCompare(b.name)
    );
}

export async function getRequirement(
  session: AppSession,
  documentId: string
): Promise<RequirementRow | null> {
  const rows = await listRequirements(session);
  return rows.find((r) => r.id === documentId) ?? null;
}

/**
 * A claim's checklist, in the same shape as an account requirement.
 *
 * Deliberately the same `RequirementRow`: `UploadDialog` and `ReviewDrawer` already know how to
 * render, upload, version and review one of these, and giving claims their own near-identical
 * row type would mean maintaining two copies of both components.
 */
export async function listClaimDocuments(
  session: AppSession,
  claimId: string
): Promise<RequirementRow[]> {
  const db = await readDb();
  const claim = db.claims.find((c) => c.id === claimId);
  if (!claim) return [];
  const account = db.accounts.find((a) => a.id === claim.accountId);
  if (!account) return [];
  if (session.role === "LENDER" && account.lenderOrgId !== session.lenderOrgId) {
    return [];
  }

  // Config order for the system checklist — the doc id is `<claimId>_doc<N>`. Lender-added
  // documents (no such index) trail, in the order they were added.
  const configIndex = (id: string): number => {
    const m = /_doc(\d+)$/.exec(id);
    return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
  };

  return db.claimDocuments
    .filter((d) => d.claimId === claimId)
    .filter((d) => session.role === "IMGC" || isActive(d))
    .map((d) => toRow(d, db))
    .sort((a, b) => {
      const ai = configIndex(a.id);
      const bi = configIndex(b.id);
      if (ai !== bi) return ai - bi;
      return a.addedOn.localeCompare(b.addedOn);
    });
}

/** The case list the "Select case" picker offers — scoped the same way. */
export async function listCaseOptions(session: AppSession) {
  const db = await readDb();
  return db.accounts
    .filter((a) => session.role === "IMGC" || a.lenderOrgId === session.lenderOrgId)
    .map((a) => ({
      id: a.id,
      loanNo: a.loanNo,
      borrowerName: a.borrowerName,
      product: a.product,
    }))
    .sort((a, b) => a.loanNo.localeCompare(b.loanNo));
}

/** Headline counts for the page band and the dashboard tiles. */
export function summariseRequirements(rows: RequirementRow[]) {
  const live = rows.filter((r) => r.active);
  const by = (s: DocStatus) => live.filter((r) => r.status === s).length;
  return {
    total: live.length,
    pendingUpload: by("PENDING_UPLOAD"),
    underReview: by("UNDER_REVIEW"),
    approved: by("APPROVED"),
    rejected: by("REJECTED"),
    reuploadRequired: by("REUPLOAD_REQUIRED"),
    notRequested: by("NOT_REQUESTED"),
    overdue: live.filter(
      (r) =>
        r.dueDate &&
        Date.parse(r.dueDate) < Date.now() &&
        r.status !== "APPROVED"
    ).length,
  };
}
