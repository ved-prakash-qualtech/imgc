import { redirectTo } from "@imgc/lib/zoneRedirect";

import { ROUTES } from "@imgc/constants/route";

/**
 * Initiating a claim and tracking one used to be two separate tabs. They are now one grid at
 * `/initiate-claim` — this route only exists so a bookmark or an old link still lands somewhere.
 */
export default function TrackClaimRedirect() {
  redirectTo(ROUTES.initiateClaim);
}
