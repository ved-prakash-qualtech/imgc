"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/route";
import { requireSession } from "@/lib/auth/appSession";
import { createLenderAccess } from "@/services/portal/users.server";

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
