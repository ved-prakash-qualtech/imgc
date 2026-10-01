"use client";

import { useTranslations } from "next-intl";
import { BuildingIcon, CheckIcon } from "lucide-react";

import { timelineEntries } from "@imgc/features/portal/ClaimStatusHistoryGraph";
import { Panel } from "@imgc/features/portal/Panel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@imgc/ui/ui/dialog";
import { cn } from "@imgc/lib/utils/twMergeUtils";
import type { ClaimStatusEntry } from "@imgc/types/domain";

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
  action,
  initiatedByImgc = false,
}: Readonly<{
  history: readonly ClaimStatusEntry[];
  currentStatus: ClaimStatusEntry["status"];
  /** Right-hand slot on the bar (e.g. IMGC's Export CSV on the Decision tab). */
  action?: React.ReactNode;
  /** Claim by IMGC — the claim was started by IMGC for the lender, not by the lender. */
  initiatedByImgc?: boolean;
}>) {
  const t = useTranslations("claim.claimDetail");
  const tPanel = useTranslations("claim.statusPanel");
  const tStatus = useTranslations("status");
  const tClaim = useTranslations("claim");
  const roleLabel = (role: ClaimStatusEntry["byRole"]) =>
    role === "SYSTEM" ? tClaim("system") : tStatus(role);
  const entries = timelineEntries(history, currentStatus);
  const visualCurrentStatus =
    currentStatus === "DOCUMENTS_RESUBMITTED" ? "UNDER_REVIEW" : currentStatus;
  // Refund Received is now a real step in `entries` (see `timelineEntries`), so this matches it
  // directly — no remapping needed, same as every other status.
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
          <h2 className="text-ui-lead-lg font-semibold text-neutral-950">
            {tPanel("claimStatus")}
          </h2>
          {initiatedByImgc && (
            <span
              className="rounded-full border border-brand-primary/40 bg-brand-light/70 px-2 py-0.5 text-ui-caption font-semibold whitespace-nowrap text-brand-primary"
              title={t("startedByImgc")}
            >
              {tPanel("initiatedByImgc")}
            </span>
          )}
          <div
            className={cn(
              "flex items-center rounded-full border px-2 py-1",
              visualCurrentStatus === "APPROVED"
                ? "border-success-500/50 bg-success/10"
                : visualCurrentStatus === "REJECTED"
                  ? "border-destructive/50 bg-destructive/5"
                  : "border-brand-primary/50 bg-brand-light/70"
            )}
          >
            <p
              className={cn(
                "text-ui-body-sm leading-tight font-semibold whitespace-nowrap",
                visualCurrentStatus === "APPROVED"
                  ? "text-success-700"
                  : visualCurrentStatus === "REJECTED"
                    ? "text-destructive"
                    : "text-brand-primary"
              )}
            >
              {tStatus(visualCurrentStatus)}
              <span
                className={cn(
                  "ml-1.5 rounded-full px-1 py-0.5 text-ui-nano font-bold tracking-wide uppercase",
                  visualCurrentStatus === "APPROVED"
                    ? "bg-success/20 text-success-700"
                    : visualCurrentStatus === "REJECTED"
                      ? "bg-destructive/15 text-destructive"
                      : "bg-brand-primary/15 text-brand-primary"
                )}
              >
                {tPanel("current")}
              </span>
            </p>
          </div>
        </div>

        <Dialog>
          <DialogTrigger className="text-ui-body-lg font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 rounded-sm">
            {tPanel("auditTrail")}
          </DialogTrigger>
          <DialogContent className="flex max-h-[85vh] w-full sm:max-w-md flex-col overflow-hidden p-0">
            <DialogHeader className="shrink-0 border-b border-neutral-100 px-5 py-4">
              <DialogTitle className="text-lg">
                {tPanel("auditTrail")}
              </DialogTitle>
              {/* Said once, at the top: who started the claim is a fact about the claim, not a
                  step in it — and per-step attribution is easy to read past. */}
              {initiatedByImgc && (
                <p className="mt-1 flex items-center gap-1.5 text-ui-body-lg font-medium text-brand-primary">
                  <BuildingIcon className="size-3.5 shrink-0" />
                  {tPanel("initiatedByImgcOnBehalf")}
                </p>
              )}
            </DialogHeader>
            <div className="flex-1 overflow-y-auto bg-neutral-50/50 px-5 py-5 custom-scrollbar">
              <ol className="relative ml-2 border-l border-neutral-200">
                {entries.map((entry, i) => {
                  const isCurrent =
                    i === currentIndex && entry.status !== "APPROVED";
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
                            <span className="text-ui-label leading-none font-bold">
                              {i + 1}
                            </span>
                          </span>
                        ) : isFuture ? (
                          <span className="text-ui-label leading-none font-bold">
                            {i + 1}
                          </span>
                        ) : (
                          <CheckIcon className="size-3.5" strokeWidth={3} />
                        )}
                      </span>
                      <div className="flex flex-col">
                        <h3
                          className={cn(
                            "text-ui-subhead font-semibold leading-tight",
                            isCurrent
                              ? "text-brand-primary"
                              : isFuture
                                ? "text-neutral-500"
                                : "text-neutral-900"
                          )}
                        >
                          {tStatus(entry.status)}
                        </h3>
                        <p className="mt-0.5 text-ui-body-sm text-neutral-500">
                          {isFuture ? "—" : when(entry.at)}
                        </p>
                        {/* The full chain of who did what, when — every entry already carries
                            this (see `advance()` in claimFlow.server.ts), it just wasn't shown
                            here before. `byId` is the exact user record; the name/role above it
                            is what a reader actually wants at a glance. */}
                        {!isFuture && (
                          <p
                            className="mt-0.5 text-ui-body-sm text-neutral-600"
                            title={tPanel("userId", { id: entry.byId })}
                          >
                            {tPanel("by")}{" "}
                            <span className="font-medium text-neutral-800">
                              {entry.byName}
                            </span>{" "}
                            · {roleLabel(entry.byRole)}
                          </p>
                        )}
                        <p className="mt-1 flex items-center gap-1.5">
                          {isCurrent ? (
                            <span className="rounded-full bg-brand-primary/15 px-1.5 py-0.5 text-ui-micro font-bold tracking-wide text-brand-primary uppercase">
                              {tPanel("current")}
                            </span>
                          ) : isFuture ? (
                            <span className="rounded-full bg-neutral-200/50 px-1.5 py-0.5 text-ui-micro font-bold tracking-wide text-neutral-500 uppercase">
                              {tPanel("pending")}
                            </span>
                          ) : (
                            <span className="rounded-full bg-success-500/15 px-1.5 py-0.5 text-ui-micro font-bold tracking-wide text-success-700 uppercase">
                              {tPanel("completed")}
                            </span>
                          )}
                        </p>
                        {/* The step's note is not repeated here — remarks belong to the
                            Remarks panel and the query trail, which is where both sides read
                            them. The trail shows what changed, when and by whom. */}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </DialogContent>
        </Dialog>
        {action && <div className="ml-auto">{action}</div>}
      </div>
    </Panel>
  );
}
