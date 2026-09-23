"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/route";
import { runAction } from "@/lib/actions/runAction";
import { requireSession } from "@/lib/auth/appSession";
import {
  bulkMarkRefundReceived,
  type BulkRefundResult,
  type BulkRefundRow,
} from "@/services/portal/claimFlow.server";

export type BulkRefundActionResult = Readonly<{
  ok: boolean;
  error?: string;
  results?: BulkRefundResult[];
}>;

/** IMGC only — one CSV row per claim (Claim No., UTR), each recorded through the same rule the
 *  one-at-a-time "Refund Received" button uses. See `bulkMarkRefundReceived`. */
export async function bulkMarkRefundReceivedAction(
  rows: readonly BulkRefundRow[]
): Promise<BulkRefundActionResult> {
  return runAction(async () => {
    const session = await requireSession();
    if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };
    if (rows.length === 0) {
      return { ok: false, error: "The file has no rows to upload." };
    }
    const { results } = await bulkMarkRefundReceived(session, rows);
    // Every row that succeeded touched a different claim/account — revalidating the whole
    // Claims grid is simpler and just as correct as computing each row's own account path.
    if (results.some((r) => r.ok)) {
      revalidatePath(ROUTES.accounts);
      revalidatePath(ROUTES.claimDashboard);
    }
    return { ok: true, results };
  });
}
