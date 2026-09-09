"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/route";
import { requireSession } from "@/lib/auth/appSession";
import {
  createLenderAccess,
  createLenderOrg,
  updateLenderOrg,
} from "@/services/portal/users.server";

export type Result = Readonly<{ ok: boolean; error?: string }>;

/** BRD: initial lender access is granted by IMGC; the email domain decides what they will see. */
export async function grantLenderAccessAction(
  name: string,
  email: string,
  orgName: string
): Promise<Result> {
  const session = await requireSession();
  const result = await createLenderAccess(session, { name, email, orgName });
  if (result.ok) {
    revalidatePath(ROUTES.adminUsers);
    revalidatePath(ROUTES.notifications);
  }
  return result;
}

/** Onboard a lender organisation ahead of anyone from it having a login. */
export async function createLenderOrgAction(
  name: string,
  emailDomain: string,
  contactEmails: string
): Promise<Result> {
  const session = await requireSession();
  const result = await createLenderOrg(session, { name, emailDomain, contactEmails });
  if (result.ok) revalidatePath(ROUTES.adminUsers);
  return result;
}

/** Correct an organisation's name or its stakeholder mailboxes. The domain is not editable —
 *  it is the key everything is scoped through (see `updateLenderOrg`). */
export async function updateLenderOrgAction(
  orgId: string,
  name: string,
  contactEmails: string
): Promise<Result> {
  const session = await requireSession();
  const result = await updateLenderOrg(session, orgId, { name, contactEmails });
  if (result.ok) revalidatePath(ROUTES.adminUsers);
  return result;
}
