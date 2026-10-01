"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/route";
import { runAction } from "@/lib/actions/runAction";
import { requireSession } from "@/lib/auth/appSession";
import {
  getUserPersonalization,
  updateUserPersonalization,
  resetUserPersonalization,
  type Outcome,
  type UserPersonalizationData,
} from "@/services/portal/brandingConfig.server";
import type { LenderCustomColors, LenderTheme } from "@/server/mock/types";

/**
 * Saves personal appearance preferences for the current logged-in user.
 * Note: Users cannot update organization logoUrl or portalTitle.
 */
export async function savePersonalizationAction(input: {
  colorMode?: "light" | "dark" | "system";
  themeKey?: string;
  theme?: Partial<LenderTheme>;
  customColors?: LenderCustomColors;
  bgPattern?: string;
  language?: string;
  density?: "comfortable" | "compact" | "spacious" | "executive" | "presentation";
  highContrast?: boolean;
  largeClickTargets?: boolean;
}): Promise<Outcome> {
  return runAction(async () => {
    const session = await requireSession();
    const result = await updateUserPersonalization(session, input);
    if (result.ok) {
      revalidatePath(ROUTES.personalization);
      revalidatePath(ROUTES.claimDashboard);
      revalidatePath(ROUTES.dashboard);
      revalidatePath(ROUTES.accounts);
      revalidatePath(ROUTES.initiateClaim);
    }
    return result;
  });
}

/**
 * Resets personal appearance settings for the current user to inherit their organization's default.
 */
export async function resetPersonalizationAction(): Promise<Outcome> {
  return runAction(async () => {
    const session = await requireSession();
    const result = await resetUserPersonalization(session);
    if (result.ok) {
      revalidatePath(ROUTES.personalization);
      revalidatePath(ROUTES.claimDashboard);
      revalidatePath(ROUTES.dashboard);
      revalidatePath(ROUTES.accounts);
      revalidatePath(ROUTES.initiateClaim);
    }
    return result;
  });
}
