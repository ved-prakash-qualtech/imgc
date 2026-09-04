import { redirect } from "next/navigation";

import { ROUTES } from "@/constants/route";
import { getSessionOrNull } from "@/lib/auth/appSession";

/** Front door — straight to the workspace when signed in, otherwise to sign-in. */
export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSessionOrNull();
  redirect(session ? ROUTES.dashboard : ROUTES.login);
}
