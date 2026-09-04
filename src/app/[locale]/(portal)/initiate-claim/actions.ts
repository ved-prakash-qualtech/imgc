"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/route";
import { requireSession } from "@/lib/auth/appSession";
import {
  askClaimQuestion,
  createClaim,
  raiseQuery,
  saveClaimDraft,
  submitClaim,
  updateClaimStatus,
  type Outcome,
} from "@/services/portal/claimFlow.server";
import type { ClaimStatus, ClaimTypeKey } from "@/server/mock/types";

/**
 * Every claim mutation invalidates the same set of routes.
 *
 * The grid, the workspace, Track Claim, the dashboard tiles and the notification badge all read
 * the same claim rows, so a status change has to reach all of them or one screen keeps showing
 * the previous state.
 */
function refreshAll(accountId?: string, claimId?: string): void {
  revalidatePath(ROUTES.initiateClaim);
  revalidatePath(ROUTES.trackQueryResponse);
  revalidatePath(ROUTES.auditTrail);
  revalidatePath(ROUTES.accounts);
  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.notifications);
  revalidatePath(ROUTES.additionalDocuments);
  if (accountId) {
    revalidatePath(ROUTES.account(accountId));
    revalidatePath(ROUTES.initiateClaimWorkspace(accountId));
  }
  if (claimId) revalidatePath(ROUTES.claimDetails(claimId));
}

export async function createClaimAction(
  accountId: string,
  claimType: ClaimTypeKey
): Promise<Outcome> {
  const session = await requireSession();
  const result = await createClaim(session, accountId, claimType);
  if (result.ok) refreshAll(accountId, result.claimId);
  return result;
}

export async function saveDraftAction(
  accountId: string,
  claimId: string,
  fields: Record<string, string>
): Promise<Outcome> {
  const session = await requireSession();
  const result = await saveClaimDraft(session, claimId, fields);
  if (result.ok) refreshAll(accountId, claimId);
  return result;
}

export async function submitClaimAction(
  accountId: string,
  claimId: string,
  fields: Record<string, string>
): Promise<Outcome> {
  const session = await requireSession();
  const result = await submitClaim(session, claimId, fields);
  if (result.ok) refreshAll(accountId, claimId);
  return result;
}

/** IMGC only — the service refuses a lender regardless of what the UI offers. */
export async function raiseQueryAction(
  claimId: string,
  input: { reason: string; remarks: string; requestedDocuments: string[] }
): Promise<Outcome> {
  const session = await requireSession();
  const result = await raiseQuery(session, claimId, input);
  if (result.ok) refreshAll(undefined, claimId);
  return result;
}

/**
 * Lender only — a question to IMGC about their own claim.
 *
 * Separate from `raiseQueryAction` on purpose: a formal query halts the claim, and a lender must
 * not be able to do that to their own.
 */
export async function askQuestionAction(
  claimId: string,
  question: string
): Promise<Outcome> {
  const session = await requireSession();
  const result = await askClaimQuestion(session, claimId, question);
  if (result.ok) refreshAll(undefined, claimId);
  return result;
}

/** IMGC only — move a claim along its flow, or decide it. */
export async function updateClaimStatusAction(
  claimId: string,
  status: ClaimStatus,
  remarks: string
): Promise<Outcome> {
  const session = await requireSession();
  const result = await updateClaimStatus(session, claimId, status, remarks);
  if (result.ok) refreshAll(undefined, claimId);
  return result;
}
