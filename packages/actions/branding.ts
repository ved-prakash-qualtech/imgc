"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@imgc/constants/route";
import { runAction } from "@imgc/data/server/actions/runAction";
import { requireSession } from "@imgc/lib/auth/appSession";
import {
  updateLenderBranding,
  resetLenderBranding,
  type Outcome,
} from "@imgc/data/services/portal/brandingConfig.server";
import type { LenderTheme } from "@imgc/types/domain";

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
