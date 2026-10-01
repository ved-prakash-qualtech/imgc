import { redirectTo } from "@imgc/lib/zoneRedirect";

import { LoginClient } from "@/app/[locale]/login/LoginClient";
import { ROUTES } from "@imgc/constants/route";
import { getSessionOrNull } from "@imgc/lib/auth/appSession";

/**
 * The front door. Two roles, one field: an Employee ID starts the IMGC password flow, an email
 * address starts the lender's one-time-code flow. Which accounts a lender then sees follows from
 * the domain of that verified address.
 */
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  if (await getSessionOrNull()) redirectTo(ROUTES.claimDashboard);

  const { returnTo } = await searchParams;
  const safe =
    returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : undefined;

  return <LoginClient returnTo={safe} />;
}
