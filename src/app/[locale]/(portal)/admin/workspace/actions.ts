"use server";

import type { ServerErrorCode, ServerErrorParams } from "@/config/errorCodes";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { ROUTES } from "@/constants/route";
import { requireSession } from "@/lib/auth/appSession";
import { setAdminContext, clearAdminContext } from "@/lib/auth/adminContext";
import { listLenderOrgs } from "@/services/portal/users.server";

export async function enterAdminContextAction(
  lenderOrgId: string
): Promise<{ code?: ServerErrorCode; codeParams?: ServerErrorParams } | void> {
  const session = await requireSession();

  if (session.role !== "IMGC") {
    return {
      code: "IMGC_STAFF_ONLY_FOR_LENDER",
    };
  }

  if (!lenderOrgId) {
    return { code: "LENDER_NOT_SELECTED" };
  }

  const orgs = await listLenderOrgs();
  const org = orgs.find((o) => o.id === lenderOrgId);
  if (!org) {
    return { code: "LENDER_INVALID" };
  }

  await setAdminContext(lenderOrgId);
  revalidatePath("/", "layout");
  const locale = await getLocale();
  return redirect({ href: ROUTES.initiateClaim, locale }) as never;
}

export async function exitAdminContextAction(): Promise<void> {
  const session = await requireSession();

  // Only process if it's an admin, though technically anyone could clear a cookie they shouldn't have.
  if (session.role === "IMGC") {
    await clearAdminContext();
  }

  revalidatePath("/", "layout");
  const locale = await getLocale();
  return redirect({ href: ROUTES.claimDashboard, locale }) as never;
}
