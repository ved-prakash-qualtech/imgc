"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/route";
import { runAction } from "@/lib/actions/runAction";
import { requireSession } from "@/lib/auth/appSession";
import {
  updateLenderBranding,
  resetLenderBranding,
  type Outcome,
} from "@/services/portal/brandingConfig.server";
import type { LenderTheme } from "@/server/mock/types";

/**
 * IMGC Administrator action to save custom branding (logo, title, theme tokens) for a lender.
 */
export async function saveBrandingAction(
  lenderOrgId: string,
  input: {
    logoUrl?: string;
    imgcLogoUrl?: string;
    portalTitle?: string;
    theme?: Partial<LenderTheme>;
  }
): Promise<Outcome> {
  return runAction(async () => {
    const session = await requireSession();
    const result = await updateLenderBranding(session, lenderOrgId, input);
    if (result.ok) {
      revalidatePath(ROUTES.adminBranding);
      revalidatePath(ROUTES.claimDashboard);
      revalidatePath(ROUTES.accounts);
      revalidatePath(ROUTES.personalization);
      revalidatePath("/", "layout");
    }
    return result;
  });
}

/**
 * IMGC Administrator action to reset a lender's branding to system defaults.
 */
export async function resetBrandingAction(
  lenderOrgId: string
): Promise<Outcome> {
  return runAction(async () => {
    const session = await requireSession();
    const result = await resetLenderBranding(session, lenderOrgId);
    if (result.ok) {
      revalidatePath(ROUTES.adminBranding);
      revalidatePath(ROUTES.claimDashboard);
      revalidatePath(ROUTES.accounts);
    }
    return result;
  });
}
