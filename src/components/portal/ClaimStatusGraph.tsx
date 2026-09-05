import { CheckIcon, CircleDotIcon, XIcon } from "lucide-react";

import { StatusPill } from "@/components/portal/StatusPill";
import {
  CLAIM_STATUS_LABELS,
  flowPosition,
  TERMINAL_STATUSES,
} from "@/config/claimConfig";
import { cn } from "@/lib/utils/twMergeUtils";
import type { ClaimStatus, ClaimTypeKey } from "@/server/mock/types";

/**
 * The claim's lifecycle rail — where it has got to, on the claim type's configured flow.
 *
 * Not a dashboard chart: it never reads sales/revenue/account-count data, only this one claim's
 * `status` against its type's `statusFlow`. Extracted out of `ClaimTimeline` so a page can show
 * the rail and the history list as two separate sections (Track Claim needs Query Response
 * between them) without duplicating the flow-position logic.
 */
export function ClaimStatusGraph({
  claimType,
  status,
}: Readonly<{
  claimType: ClaimTypeKey;
  status: ClaimStatus;
}>) {
  const { flow, index } = flowPosition(claimType, status);
  const rejected = status === "REJECTED";
  const offPath = !flow.includes(status);

  return (
    <div className="space-y-4">
      <ol className="flex flex-wrap items-center gap-y-3">
        {flow.map((step, i) => {
          const done = i < index || (i === index && TERMINAL_STATUSES.has(status));
          const current = i === index && !TERMINAL_STATUSES.has(status);
          const failed = rejected && i === index;

          return (
            <li key={step} className="flex items-center">
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full border-2 transition",
                    failed
                      ? "border-destructive bg-destructive text-white"
                      : done
                        ? "border-success-500 bg-success-500 text-white"
                        : current
                          ? "border-brand-primary bg-brand-primary text-white"
                          : "border-neutral-200 bg-white text-neutral-300"
                  )}
                >
                  {failed ? (
                    <XIcon className="size-3.5" />
                  ) : done ? (
                    <CheckIcon className="size-3.5" />
                  ) : (
                    <CircleDotIcon className="size-3" />
                  )}
                </span>
                <span
                  className={cn(
                    "text-[12.5px] font-medium whitespace-nowrap",
                    done || current || failed
                      ? "text-neutral-900"
                      : "text-neutral-400"
                  )}
                >
                  {CLAIM_STATUS_LABELS[step]}
                </span>
              </span>
              {i < flow.length - 1 && (
                <span
                  className={cn(
                    "mx-3 h-0.5 w-8 rounded-full",
                    i < index ? "bg-success-500" : "bg-neutral-200"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* A branch status is not on the rail, so it is called out rather than silently
          rendered as whatever mainline step it sits closest to. */}
      {offPath && (
        <p className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/8 px-3 py-2 text-[12.5px] text-neutral-800">
          <span className="font-semibold">Currently:</span>
          <StatusPill status={status} />
          <span className="text-neutral-600">
            — the claim is off the standard path until this is resolved.
          </span>
        </p>
      )}
    </div>
  );
}
