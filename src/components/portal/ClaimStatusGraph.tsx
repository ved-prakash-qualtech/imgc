import { CheckIcon, ChevronRightIcon, XIcon } from "lucide-react";

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
 *
 * Same pill-and-chevron design as `ClaimStatusHistoryGraph` (Track Claim's own status rail) —
 * one visual language for "where is this claim" everywhere it's shown, whether that's the whole
 * configured pipeline (here) or only what has actually happened (there).
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
              <div
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5",
                  failed
                    ? "border-destructive/50 bg-destructive/10"
                    : current
                      ? "border-brand-primary/50 bg-brand-light/70"
                      : done
                        ? "border-neutral-200 bg-neutral-100"
                        : "border-neutral-100 bg-neutral-50"
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full",
                    failed
                      ? "bg-destructive text-white"
                      : done
                        ? "bg-success-500 text-white"
                        : current
                          ? "bg-brand-primary text-white"
                          : "bg-white text-neutral-300 ring-1 ring-inset ring-neutral-200"
                  )}
                >
                  {failed ? (
                    <XIcon className="size-3.5" strokeWidth={3} />
                  ) : done ? (
                    <CheckIcon className="size-3.5" strokeWidth={3} />
                  ) : (
                    <span className="text-[9.5px] font-bold">{i + 1}</span>
                  )}
                </span>
                <span
                  className={cn(
                    "text-[12.5px] font-semibold whitespace-nowrap",
                    failed
                      ? "text-destructive"
                      : current
                        ? "text-brand-primary"
                        : done
                          ? "text-neutral-900"
                          : "text-neutral-400"
                  )}
                >
                  {CLAIM_STATUS_LABELS[step]}
                  {current && (
                    <span className="ml-1.5 rounded-full bg-brand-primary/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-brand-primary uppercase">
                      Current
                    </span>
                  )}
                </span>
              </div>
              {i < flow.length - 1 && (
                <ChevronRightIcon className="mx-1.5 size-4 shrink-0 text-neutral-400" />
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
