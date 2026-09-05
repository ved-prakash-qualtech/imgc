import { CheckIcon } from "lucide-react";

import { CLAIM_STATUS_LABELS } from "@/config/claimConfig";
import { cn } from "@/lib/utils/twMergeUtils";
import type { ClaimStatusEntry } from "@/server/mock/types";

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
 * The claim's status progression, generated only from what actually happened.
 *
 * Deliberately not the same rail as `ClaimStatusGraph`/`ClaimTimeline` (used on the Initiate Claim
 * workspace): that one shows the type's whole configured pipeline, future steps included, because
 * a lender filling out a form benefits from seeing what's still ahead. Track Claim asks for the
 * opposite — only stages present in `statusHistory`, growing as events happen and never
 * hallucinating a step that hasn't occurred — so this reads the history directly instead of
 * comparing it against `claimConfig`'s flow.
 *
 * A single scrollable row rather than `flex-wrap`: wrapping broke alignment the moment a claim
 * had more than five or six events (the second row's dots didn't line up under the first row's),
 * and a claim's real history can run well past that once a query bounces back and forth a few
 * times. Scrolling keeps every node on one baseline no matter how long the history gets.
 */
export function ClaimStatusHistoryGraph({
  history,
}: Readonly<{ history: readonly ClaimStatusEntry[] }>) {
  const entries = [...history];

  if (entries.length === 0) {
    return (
      <p className="px-1 text-[13px] text-neutral-500">
        No status history yet.
      </p>
    );
  }

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <ol className="flex min-w-max items-start">
        {entries.map((entry, i) => {
          const isCurrent = i === entries.length - 1;
          return (
            <li key={`${entry.status}-${entry.at}-${i}`} className="flex items-start">
              <div className="flex w-[104px] shrink-0 flex-col items-center text-center">
                <span
                  className={cn(
                    "relative grid size-8 shrink-0 place-items-center rounded-full text-white shadow-sm ring-4",
                    isCurrent
                      ? "bg-brand-primary ring-brand-light"
                      : "bg-success-500 ring-success-50"
                  )}
                >
                  {isCurrent ? (
                    <span className="absolute inline-flex size-8 animate-ping rounded-full bg-brand-primary/50" />
                  ) : null}
                  <span className="relative">
                    {isCurrent ? (
                      <span className="text-[11px] font-bold">{i + 1}</span>
                    ) : (
                      <CheckIcon className="size-4" strokeWidth={3} />
                    )}
                  </span>
                </span>
                <div className="mt-2">
                  <p
                    className={cn(
                      "text-[12.5px] leading-tight font-semibold whitespace-nowrap",
                      isCurrent ? "text-brand-primary" : "text-neutral-900"
                    )}
                  >
                    {CLAIM_STATUS_LABELS[entry.status]}
                  </p>
                  <p className="mt-1 text-[10.5px] leading-tight whitespace-nowrap text-neutral-500">
                    {when(entry.at)}
                  </p>
                  {isCurrent && (
                    <span className="mt-1.5 inline-flex items-center rounded-full bg-brand-light px-2 py-0.5 text-[9.5px] font-bold tracking-wide text-brand-primary uppercase">
                      Current
                    </span>
                  )}
                </div>
              </div>
              {i < entries.length - 1 && (
                <div className="mt-4 h-0.5 w-10 shrink-0 self-start rounded-full bg-[linear-gradient(90deg,var(--color-success-500)_0%,var(--color-success-500)_100%)] sm:w-16" />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
