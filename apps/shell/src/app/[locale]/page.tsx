import { redirectTo } from "@imgc/lib/zoneRedirect";

import { ROUTES } from "@imgc/constants/route";
import { getSessionOrNull } from "@imgc/lib/auth/appSession";

/** Front door — straight to the workspace when signed in, otherwise to sign-in. */
export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSessionOrNull();
  redirectTo(session ? ROUTES.claimDashboard : ROUTES.login);
}
