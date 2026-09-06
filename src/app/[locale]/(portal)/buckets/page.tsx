import { redirect } from "next/navigation";

import { ROUTES } from "@/constants/route";

/**
 * The dedicated bulk-move screen is gone — `BucketToggle` on each account's own Overview tab
 * moves it between buckets from wherever the decision is actually made, same server action
 * either way. This route only exists so a bookmark or an old link still lands somewhere.
 */
export default function BucketsRedirect() {
  redirect(ROUTES.accounts);
}
