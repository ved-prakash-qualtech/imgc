import "server-only";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { withDbTransaction } from "@/server/mock/db";
import { StaleSnapshotError } from "@/server/mock/storage";

export type ActionFailure = Readonly<{ ok: false; error: string }>;

/**
 * The body of every portal Server Action.
 *
 * Three jobs:
 *
 * - **One transaction.** The action's reads and writes — its own change plus the audit event,
 *   mail and notification rows it records — share one loaded snapshot and persist in one write
 *   (`withDbTransaction`). Either all of it lands or none of it does.
 * - **One round trip.** A successful action calls `refresh()`, so the refreshed page comes back in
 *   the action's own response. Screens used to follow every action with `router.refresh()`, which
 *   rendered the whole page a second time in a second request.
 * - **A result, never a throw.** A thrown error used to escape the action and the client's
 *   `startTransition`, which only handle `{ ok: false }` — so a failed save crashed the screen
 *   instead of saying so, and the natural response (try again) stacked another full chain of
 *   writes behind the one that had just failed. Now any failure comes back as `{ ok: false }` and
 *   the existing error toast shows it.
 *
 * Next's own control-flow errors (redirect, notFound) are rethrown untouched.
 */
export async function runAction<T extends { ok: boolean }>(
  fn: () => Promise<T>
): Promise<T | ActionFailure> {
  try {
    const result = await withDbTransaction(fn);
    if (result.ok) refresh();
    return result;
  } catch (error) {
    unstable_rethrow(error);
    console.error("[action] failed:", error);
    return {
      ok: false,
      error:
        error instanceof StaleSnapshotError
          ? "Someone else saved a change at the same moment. Please try again."
          : "That could not be saved. Please try again.",
    };
  }
}
