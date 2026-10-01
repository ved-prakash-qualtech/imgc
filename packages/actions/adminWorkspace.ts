"use server";

import type {
  ServerErrorCode,
  ServerErrorParams,
} from "@imgc/config/errorCodes";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirectTo } from "@imgc/lib/zoneRedirect";
import { ROUTES } from "@imgc/constants/route";
import { requireSession } from "@imgc/lib/auth/appSession";
import {
  setAdminContext,
  clearAdminContext,
} from "@imgc/lib/auth/adminContext";
import { listLenderOrgs } from "@imgc/data/services/portal/users.server";

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
  return redirectTo(ROUTES.initiateClaim, locale);
}

export async function exitAdminContextAction(): Promise<void> {
  const session = await requireSession();

  // Only process if it's an admin, though technically anyone could clear a cookie they shouldn't have.
  if (session.role === "IMGC") {
    await clearAdminContext();
  }

  revalidatePath("/", "layout");
  const locale = await getLocale();
  return redirectTo(ROUTES.claimDashboard, locale);
}
