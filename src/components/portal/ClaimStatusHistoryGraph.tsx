import { CheckIcon, ChevronRightIcon } from "lucide-react";

import { CLAIM_STATUS_LABELS } from "@/config/claimConfig";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

/** Collapses a run of consecutive same-status entries (e.g. a query bounced back and forth
 *  between IMGC and the lender a few times) into just the latest one — the step is "query
 *  raised", not "query raised, again, again". */
function collapseConsecutive(
  history: readonly ClaimStatusEntry[]
): ClaimStatusEntry[] {
  const out: ClaimStatusEntry[] = [];
  for (const entry of history) {
    const last = out[out.length - 1];
    if (last && last.status === entry.status) {
      out[out.length - 1] = entry;
    } else {
      out.push(entry);
    }
  }
  return out;
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
 * Each step is a self-contained pill with a chevron between them, not fixed-width columns joined
 * by a connecting line — that earlier design either had to scroll horizontally forever, or wrap
 * and leave the second row's dots misaligned under the first row's. A wrapping run of pills has
 * no such alignment to keep, so it never needs either.
 *
 * The timestamp lives in a hover tooltip rather than as a second line under every pill — a tight
 * row of small pills reads faster than one padded out with a date most people only need to check
 * occasionally, and it's still one hover away for whoever does.
 */
export function ClaimStatusHistoryGraph({
  history,
}: Readonly<{ history: readonly ClaimStatusEntry[] }>) {
  const entries = collapseConsecutive(history);

  if (entries.length === 0) {
    return (
      <p className="px-1 text-[13px] text-neutral-500">
        No status history yet.
      </p>
    );
  }

  return (
    <ol className="flex flex-wrap items-center gap-y-2">
      {entries.map((entry, i) => {
        const isCurrent = i === entries.length - 1;
        return (
          <li
            key={`${entry.status}-${entry.at}-${i}`}
            className="flex items-center"
          >
            <Tooltip>
              <TooltipTrigger
                render={
                  <div
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2 py-1",
                      isCurrent
                        ? "border-brand-primary/50 bg-brand-light/70"
                        : "border-neutral-200 bg-neutral-100"
                    )}
                  >
                    <span
                      className={cn(
                        "relative grid size-4 shrink-0 place-items-center rounded-full text-white",
                        isCurrent ? "bg-brand-primary" : "bg-success-500"
                      )}
                    >
                      {isCurrent ? (
                        <span className="absolute inline-flex size-4 animate-ping rounded-full bg-brand-primary/50" />
                      ) : null}
                      <span className="relative grid place-items-center leading-none">
                        {isCurrent ? (
                          <span className="text-[8px] leading-none font-bold">{i + 1}</span>
                        ) : (
                          <CheckIcon className="size-2.5" strokeWidth={3} />
                        )}
                      </span>
                    </span>
                    <p
                      className={cn(
                        "text-[11px] leading-tight font-semibold whitespace-nowrap",
                        isCurrent ? "text-brand-primary" : "text-neutral-900"
                      )}
                    >
                      {CLAIM_STATUS_LABELS[entry.status]}
                      {isCurrent && (
                        <span className="ml-1 rounded-full bg-brand-primary/15 px-1 py-0.5 text-[8px] font-bold tracking-wide text-brand-primary uppercase">
                          Current
                        </span>
                      )}
                    </p>
                  </div>
                }
              />
              <TooltipContent>{when(entry.at)}</TooltipContent>
            </Tooltip>
            {i < entries.length - 1 && (
              <ChevronRightIcon className="mx-1 size-3.5 shrink-0 text-neutral-400" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
