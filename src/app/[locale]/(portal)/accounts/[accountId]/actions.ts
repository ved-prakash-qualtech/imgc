"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/route";
import { requireSession } from "@/lib/auth/appSession";
import {
  addRequirement,
  setRequirementActive,
  type RequirementInput,
  decideDocument,
  decideReinstate,
  requestReinstate,
  submitClaim,
  uploadDocument,
} from "@/services/portal/claims.server";
import { addRemark } from "@/services/portal/remarks.server";
import { pushToPas } from "@/services/portal/pas.server";
import { setClaimStatus } from "@/services/portal/accounts.server";

export type Result = Readonly<{ ok: boolean; error?: string }>;

function refresh(accountId: string): void {
  revalidatePath(ROUTES.account(accountId));
  revalidatePath(ROUTES.accounts);
  revalidatePath(ROUTES.dashboard);
}

/* ── documents ─────────────────────────────────────────────────────── */

export async function uploadDocumentAction(formData: FormData): Promise<Result> {
  const session = await requireSession();
  const accountId = String(formData.get("accountId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  const file = formData.get("file");

  if (!(file instanceof File)) return { ok: false, error: "Choose a file to upload." };

  const result = await uploadDocument(session, accountId, documentId, file);
  if (result.ok) refresh(accountId);
  return result;
}

export async function addRequirementAction(
  accountId: string,
  input: RequirementInput
): Promise<Result> {
  const session = await requireSession();
  const result = await addRequirement(session, accountId, input);
  if (result.ok) refresh(accountId);
  return result;
}

/** Withdraw a requirement (or bring it back) without losing what was uploaded against it. */
export async function setRequirementActiveAction(
  accountId: string,
  documentId: string,
  active: boolean
): Promise<Result> {
  const session = await requireSession();
  const result = await setRequirementActive(session, accountId, documentId, active);
  if (result.ok) refresh(accountId);
  return result;
}

export async function decideDocumentAction(
  accountId: string,
  documentId: string,
  decision: "APPROVED" | "REJECTED",
  reason: string
): Promise<Result> {
  const session = await requireSession();
  const result = await decideDocument(
    session,
    accountId,
    documentId,
    decision,
    reason
  );
  if (result.ok) refresh(accountId);
  return result;
}

export async function submitClaimAction(accountId: string): Promise<Result> {
  const session = await requireSession();
  const result = await submitClaim(session, accountId);
  if (result.ok) refresh(accountId);
  return result;
}

export async function requestReinstateAction(
  accountId: string,
  documentId: string,
  note: string
): Promise<Result> {
  const session = await requireSession();
  const result = await requestReinstate(session, accountId, documentId, note);
  if (result.ok) refresh(accountId);
  return result;
}

export async function decideReinstateAction(
  accountId: string,
  documentId: string,
  approve: boolean,
  note: string
): Promise<Result> {
  const session = await requireSession();
  const result = await decideReinstate(session, accountId, documentId, approve, note);
  if (result.ok) {
    refresh(accountId);
    revalidatePath(ROUTES.adminRetention);
  }
  return result;
}

/* ── remarks, PAS, claim status ────────────────────────────────────── */

export async function addRemarkAction(
  accountId: string,
  body: string,
  documentId?: string
): Promise<Result> {
  const session = await requireSession();
  const result = await addRemark(session, accountId, body, documentId);
  if (result.ok) refresh(accountId);
  return result;
}

export async function updatePasValueAction(
  accountId: string,
  key: string,
  value: string
): Promise<Result> {
  const session = await requireSession();
  const result = await pushToPas(session, accountId, key, value);
  if (result.ok) refresh(accountId);
  return result;
}

export async function setClaimStatusAction(
  accountId: string,
  status: "APPROVED" | "QUERIED",
  note: string
): Promise<Result> {
  const session = await requireSession();
  const result = await setClaimStatus(session, accountId, status, note);
  if (result.ok) refresh(accountId);
  return result;
}
