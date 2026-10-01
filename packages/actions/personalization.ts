"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@imgc/constants/route";
import { runAction } from "@imgc/data/server/actions/runAction";
import { requireSession } from "@imgc/lib/auth/appSession";
import {
  updateUserPersonalization,
  resetUserPersonalization,
  type Outcome,
} from "@imgc/data/services/portal/brandingConfig.server";
import type { LenderCustomColors, LenderTheme } from "@imgc/types/domain";

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
  density?:
    "comfortable" | "compact" | "spacious" | "executive" | "presentation";
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
