import { CheckIcon, ChevronRightIcon } from "lucide-react";

import { CLAIM_STATUS_LABELS } from "@/config/claimConfig";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

function syntheticEntry(
  status: ClaimStatusEntry["status"],
  at: string,
  template?: ClaimStatusEntry
): ClaimStatusEntry {
  return {
    status,
    at,
    byId: template?.byId ?? "system",
    byName: template?.byName ?? "System",
    byRole: template?.byRole ?? "SYSTEM",
  };
}

/**
 * Builds the known lifecycle while retaining each real occurrence in history. `SUBMITTED` is the
 * lender action that hands the claim to IMGC, so the first review stage is derived immediately
 * after it; `DOCUMENTS_RESUBMITTED` is an implementation marker, not a separate timeline stage.
 */
function timelineEntries(
  history: readonly ClaimStatusEntry[],
  currentStatus: ClaimStatusEntry["status"]
): ClaimStatusEntry[] {
  const visualCurrentStatus =
    currentStatus === "DOCUMENTS_RESUBMITTED" ? "UNDER_REVIEW" : currentStatus;
  const entries: ClaimStatusEntry[] = [];
  const lastAt = history[history.length - 1]?.at ?? new Date().toISOString();
  const add = (entry: ClaimStatusEntry) => entries.push(entry);

  for (const entry of history) {
    if (entry.status === "DOCUMENTS_RESUBMITTED") continue;
    if (
      entry.status === "QUERY_RAISED" &&
      entries[entries.length - 1]?.status === "QUERY_RAISED"
    ) {
      continue;
    }

    if (
      entry.status === "QUERY_RAISED" &&
      entries[entries.length - 1]?.status !== "UNDER_REVIEW"
    ) {
      add(syntheticEntry("UNDER_REVIEW", entry.at, entry));
    }
    add(entry);
  }

  if (entries.length === 0 && visualCurrentStatus === "DRAFT") {
    add(syntheticEntry("DRAFT", lastAt));
  }

  const ensureAfter = (
    status: ClaimStatusEntry["status"],
    after: ClaimStatusEntry["status"],
    template?: ClaimStatusEntry
  ) => {
    if (entries[entries.length - 1]?.status !== after) return;
    add(
      syntheticEntry(status, lastAt, template ?? entries[entries.length - 1])
    );
  };

  if (visualCurrentStatus === "SUBMITTED") {
    ensureAfter("UNDER_REVIEW", "SUBMITTED");
  } else if (visualCurrentStatus === "UNDER_REVIEW") {
    ensureAfter("UNDER_REVIEW", "QUERY_RAISED");
    ensureAfter("UNDER_REVIEW", "SUBMITTED");
  } else if (visualCurrentStatus === "APPROVED") {
    ensureAfter("APPROVED", "UNDER_REVIEW");
  } else if (
    visualCurrentStatus === "REJECTED" ||
    visualCurrentStatus === "CLOSED" ||
    visualCurrentStatus === "QUERIED" ||
    visualCurrentStatus === "ACTIVE"
  ) {
    if (entries[entries.length - 1]?.status !== visualCurrentStatus) {
      add(syntheticEntry(visualCurrentStatus, lastAt));
    }
  }

  const addFuture = (status: ClaimStatusEntry["status"]) => {
    add(syntheticEntry(status, lastAt));
  };

  if (visualCurrentStatus === "DRAFT") {
    addFuture("SUBMITTED");
    addFuture("UNDER_REVIEW");
    addFuture("APPROVED");
  } else if (visualCurrentStatus === "SUBMITTED") {
    addFuture("APPROVED");
  } else if (visualCurrentStatus === "UNDER_REVIEW") {
    addFuture("APPROVED");
  } else if (visualCurrentStatus === "QUERY_RAISED") {
    addFuture("UNDER_REVIEW");
    addFuture("APPROVED");
  }

  return entries;
}

/**
 * The claim's status progression, generated from the canonical lifecycle and real history.
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
  currentStatus,
}: Readonly<{
  history: readonly ClaimStatusEntry[];
  currentStatus: ClaimStatusEntry["status"];
}>) {
  const entries = timelineEntries(history, currentStatus);

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
        const currentIndex =
          currentStatus === "APPROVED"
            ? entries.length
            : entries.findLastIndex(
                (item) =>
                  item.status ===
                  (currentStatus === "DOCUMENTS_RESUBMITTED"
                    ? "UNDER_REVIEW"
                    : currentStatus)
              );
        const isCurrent = i === currentIndex;
        const isFuture = i > currentIndex;
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
                        : isFuture
                          ? "border-neutral-200 bg-neutral-100 opacity-60"
                          : "border-neutral-200 bg-neutral-100"
                    )}
                  >
                    <span
                      className={cn(
                        "relative grid size-4 shrink-0 place-items-center rounded-full text-white",
                        isCurrent
                          ? "bg-brand-primary"
                          : isFuture
                            ? "bg-neutral-300"
                            : "bg-success-500"
                      )}
                    >
                      {isCurrent ? (
                        <span className="absolute inline-flex size-4 animate-ping rounded-full bg-brand-primary/50" />
                      ) : null}
                      <span className="relative grid place-items-center leading-none">
                        {isCurrent ? (
                          <span className="text-[8px] leading-none font-bold">
                            {i + 1}
                          </span>
                        ) : isFuture ? (
                          <span className="text-[8px] leading-none font-bold">
                            {i + 1}
                          </span>
                        ) : (
                          <CheckIcon className="size-2.5" strokeWidth={3} />
                        )}
                      </span>
                    </span>
                    <p
                      className={cn(
                        "text-[11px] leading-tight font-semibold whitespace-nowrap",
                        isCurrent
                          ? "text-brand-primary"
                          : isFuture
                            ? "text-neutral-500"
                            : "text-neutral-900"
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
