"use client";

import { CheckIcon } from "lucide-react";

import { CLAIM_STATUS_LABELS } from "@/config/claimConfig";
import { timelineEntries } from "@/components/portal/ClaimStatusHistoryGraph";
import { Panel } from "@/components/portal/Panel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

export function LenderClaimStatusPanel({
  history,
  currentStatus,
}: Readonly<{
  history: readonly ClaimStatusEntry[];
  currentStatus: ClaimStatusEntry["status"];
}>) {
  const entries = timelineEntries(history, currentStatus);
  const visualCurrentStatus =
    currentStatus === "DOCUMENTS_RESUBMITTED" ? "UNDER_REVIEW" : currentStatus;
  const currentIndex = entries.findLastIndex(
    (item) => item.status === visualCurrentStatus
  );

  return (
    <Panel
      className="shrink-0"
      title={undefined} // We use a custom header structure inside children or passing undefined to hide Panel's header and make our own.
    >
      <div className="flex flex-wrap items-center gap-4 px-3 py-2">
        <div className="flex items-center gap-3">
          <h2 className="text-[14.5px] font-semibold text-neutral-950">
            Claim Status
          </h2>
          <div className="flex items-center rounded-full border border-brand-primary/50 bg-brand-light/70 px-2 py-1">
            <p className="text-[11.5px] leading-tight font-semibold whitespace-nowrap text-brand-primary">
              {/* eslint-disable-next-line security/detect-object-injection */}
              {CLAIM_STATUS_LABELS[visualCurrentStatus]}
              <span className="ml-1.5 rounded-full bg-brand-primary/15 px-1 py-0.5 text-[8px] font-bold tracking-wide text-brand-primary uppercase">
                Current
              </span>
            </p>
          </div>
        </div>

        <Dialog>
          <DialogTrigger className="text-[12.5px] font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 rounded-sm">
            Status Audit Trail
          </DialogTrigger>
          <DialogContent className="flex max-h-[85vh] w-full sm:max-w-md flex-col overflow-hidden p-0">
            <DialogHeader className="shrink-0 border-b border-neutral-100 px-5 py-4">
              <DialogTitle className="text-lg">Status Audit Trail</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto bg-neutral-50/50 px-5 py-5 custom-scrollbar">
              <ol className="relative ml-2 border-l border-neutral-200">
                {entries.map((entry, i) => {
                  const isCurrent = i === currentIndex;
                  const isFuture = i > currentIndex;
                  return (
                    <li
                      key={`${entry.status}-${entry.at}-${i}`}
                      className="mb-6 ml-6 last:mb-0"
                    >
                      <span
                        className={cn(
                          "absolute -left-3 flex size-6 items-center justify-center rounded-full ring-4 ring-neutral-50/50",
                          isCurrent
                            ? "bg-brand-primary text-white"
                            : isFuture
                              ? "bg-neutral-200 text-neutral-500"
                              : "bg-success-500 text-white"
                        )}
                      >
                        {isCurrent ? (
                          <span className="relative grid place-items-center leading-none">
                            <span className="text-[11px] leading-none font-bold">
                              {i + 1}
                            </span>
                          </span>
                        ) : isFuture ? (
                          <span className="text-[11px] leading-none font-bold">
                            {i + 1}
                          </span>
                        ) : (
                          <CheckIcon className="size-3.5" strokeWidth={3} />
                        )}
                      </span>
                      <div className="flex flex-col">
                        <h3
                          className={cn(
                            "text-[13px] font-semibold leading-tight",
                            isCurrent
                              ? "text-brand-primary"
                              : isFuture
                                ? "text-neutral-500"
                                : "text-neutral-900"
                          )}
                        >
                          {CLAIM_STATUS_LABELS[entry.status]}
                        </h3>
                        <p className="mt-0.5 text-[11.5px] text-neutral-500">
                          {isFuture ? "—" : when(entry.at)}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5">
                          {isCurrent ? (
                            <span className="rounded-full bg-brand-primary/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-brand-primary uppercase">
                              Current
                            </span>
                          ) : isFuture ? (
                            <span className="rounded-full bg-neutral-200/50 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-neutral-500 uppercase">
                              Pending
                            </span>
                          ) : (
                            <span className="rounded-full bg-success-500/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-success-700 uppercase">
                              Completed
                            </span>
                          )}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Panel>
  );
}
