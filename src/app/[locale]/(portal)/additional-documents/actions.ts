"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/route";
import { requireSession } from "@/lib/auth/appSession";
import {
  addRequirement,
  decideDocument,
  setRequirementActive,
  updateRequirement,
  uploadDocument,
  type RequirementInput,
  type ReviewDecision,
  type UploadMeta,
} from "@/services/portal/claims.server";

export type Result = Readonly<{ ok: boolean; error?: string }>;

/**
 * Every mutation on the additional-documents workflow refreshes the same set of routes.
 *
 * The requirement table, the lender's list, the case workspace, the dashboard tiles and the
 * notification badge all read the same rows, so a decision taken in the review drawer has to
 * invalidate all of them or one screen will keep showing the previous status.
 */
function refreshAll(accountId?: string): void {
  revalidatePath(ROUTES.additionalDocuments);
  revalidatePath(ROUTES.requiredDocuments);
  revalidatePath(ROUTES.accounts);
  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.notifications);
  if (accountId) revalidatePath(ROUTES.account(accountId));
}

export async function addRequirementAction(
  accountId: string,
  input: RequirementInput
): Promise<Result> {
  const session = await requireSession();
  if (!accountId) return { ok: false, error: "Choose a case first." };
  const result = await addRequirement(session, accountId, input);
  if (result.ok) refreshAll(accountId);
  return result;
}

export async function updateRequirementAction(
  accountId: string,
  documentId: string,
  input: RequirementInput
): Promise<Result> {
  const session = await requireSession();
  const result = await updateRequirement(session, accountId, documentId, input);
  if (result.ok) refreshAll(accountId);
  return result;
}

export async function setActiveAction(
  accountId: string,
  documentId: string,
  active: boolean
): Promise<Result> {
  const session = await requireSession();
  const result = await setRequirementActive(session, accountId, documentId, active);
  if (result.ok) refreshAll(accountId);
  return result;
}

/** Approve · Reject · Request re-upload — the review drawer's three outcomes. */
export async function reviewDocumentAction(
  accountId: string,
  documentId: string,
  decision: ReviewDecision,
  remarks: string
): Promise<Result> {
  const session = await requireSession();
  const result = await decideDocument(session, accountId, documentId, decision, remarks);
  if (result.ok) refreshAll(accountId);
  return result;
}

/** Lender upload / re-upload, with the metadata the upload form collects. */
export async function uploadRequirementAction(formData: FormData): Promise<Result> {
  const session = await requireSession();
  const accountId = String(formData.get("accountId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  const file = formData.get("file");

  if (!(file instanceof File)) return { ok: false, error: "Choose a file to upload." };

  const meta: UploadMeta = {
    documentNumber: String(formData.get("documentNumber") ?? ""),
    documentDate: String(formData.get("documentDate") ?? ""),
    remarks: String(formData.get("remarks") ?? ""),
  };

  const result = await uploadDocument(session, accountId, documentId, file, meta);
  if (result.ok) refreshAll(accountId);
  return result;
}
