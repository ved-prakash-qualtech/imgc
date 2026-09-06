import { redirect } from "next/navigation";

import { ROUTES } from "@/constants/route";

/**
 * Initiating a claim and tracking one used to be two separate tabs. They are now one grid at
 * `/initiate-claim` — this route only exists so a bookmark or an old link still lands somewhere.
 */
export default function TrackClaimRedirect() {
  redirect(ROUTES.initiateClaim);
}
