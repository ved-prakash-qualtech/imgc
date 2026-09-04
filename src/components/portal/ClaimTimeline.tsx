import { CheckIcon, CircleDotIcon, XIcon } from "lucide-react";

import { StatusPill } from "@/components/portal/StatusPill";
import {
  CLAIM_STATUS_LABELS,
  flowPosition,
  TERMINAL_STATUSES,
} from "@/config/claimConfig";
import { cn } from "@/lib/utils/twMergeUtils";
import type {
  ClaimStatus,
  ClaimStatusEntry,
  ClaimTypeKey,
} from "@/server/mock/types";

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Where a claim has got to, and how it got there.
 *
 * Both halves are derived: the rail comes from the claim type's configured `statusFlow`, and the
 * entries come from the claim's own history. Nothing here lists statuses of its own, so a new
 * claim type or a changed flow needs no edit to this file.
 */
export function ClaimTimeline({
  claimType,
  status,
  history,
}: Readonly<{
  claimType: ClaimTypeKey;
  status: ClaimStatus;
  history: readonly ClaimStatusEntry[];
}>) {
  const { flow, index } = flowPosition(claimType, status);
  const rejected = status === "REJECTED";
  const offPath = !flow.includes(status);

  return (
    <div className="space-y-5">
      {/* ── The configured rail ─────────────────────────────── */}
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

      {/* ── What actually happened ──────────────────────────── */}
      <ol className="relative space-y-3 border-l border-neutral-200 pl-5">
        {[...history].reverse().map((entry, i) => (
          <li key={`${entry.status}-${entry.at}-${i}`} className="relative">
            <span
              className={cn(
                "absolute -left-[26px] top-1 grid size-3 place-items-center rounded-full ring-4 ring-white",
                i === 0 ? "bg-brand-primary" : "bg-neutral-300"
              )}
            />
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={entry.status} />
              <span className="text-[12px] text-neutral-500">{when(entry.at)}</span>
            </div>
            <p className="mt-0.5 text-[12.5px] text-neutral-700">
              {entry.byName}
              <span className="ml-1.5 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                {entry.byRole}
              </span>
            </p>
            {entry.note && (
              <p className="mt-1 text-[12.5px] italic text-neutral-600">{entry.note}</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
