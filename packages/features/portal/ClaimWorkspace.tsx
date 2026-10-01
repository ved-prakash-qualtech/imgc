/* eslint-disable react-perf/jsx-no-new-function-as-prop */
"use client";

import { useServerErrorMessage } from "@imgc/lib/serverErrorMessage";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  MessageSquareWarningIcon,
  SaveIcon,
  SendIcon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  saveDraftAction,
  submitClaimAction,
} from "@imgc/actions/initiateClaim";
import { discardUnsavedUploadsAction } from "@imgc/actions/additionalDocuments";
import { ClaimDocuments } from "@imgc/features/portal/ClaimDocuments";

import { LoanDetailsCard } from "@imgc/features/portal/LoanDetailsCard";
import { Button } from "@imgc/ui/ui/button";
import { ActionFooter } from "@imgc/features/portal/ActionFooter";
import { Panel } from "@imgc/features/portal/Panel";
import { claimConfig, fieldVisible } from "@imgc/config/claimConfig";
import {
  useRememberedHref,
  CLAIMS_FILTER_KEY,
} from "@imgc/lib/hooks/useRememberedFilters";
import { cn } from "@imgc/lib/utils/twMergeUtils";
import type { AccountRow } from "@imgc/data/services/portal/accounts.server";
import type { RequirementRow } from "@imgc/data/services/portal/requirements.server";
import type { ClaimQuery, ClaimStatus, ClaimTypeKey } from "@imgc/types/domain";

const INITIATION_REMARK_MAX = 2000;

type WorkspaceTab = "loan-details" | "initiate-claim";

/** A required document is still outstanding until it is with IMGC or approved. */
function outstanding(doc: RequirementRow): boolean {
  // A waiver — requested or allowed — settles the document as far as submission goes.
  return (
    doc.status !== "UNDER_REVIEW" &&
    doc.status !== "APPROVED" &&
    doc.status !== "WAIVER_REQUESTED" &&
    doc.status !== "WAIVED"
  );
}

/**
 * The lender's claim-initiation workspace: read-only loan details, then the document work.
 *
 * There is no data-entry form — loan information comes from the account, the checklist comes
 * from the claim type's configuration, and submission is gated only on the applicable mandatory
 * documents being uploaded.
 */
export function ClaimWorkspace({
  account,
  accountId,
  claimId,
  claimNo,
  claimType,
  status,
  fields,
  documents,
  openQuery,
  backHref,
}: Readonly<{
  account: AccountRow;
  accountId: string;
  claimId: string;
  claimNo: string;
  claimType: ClaimTypeKey;
  status: ClaimStatus;
  fields: Record<string, string>;
  documents: RequirementRow[];
  openQuery: ClaimQuery | null;
  backHref: string;
}>) {
  const errorText = useServerErrorMessage();
  const t = useTranslations("claimWorkspace");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(fields);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("initiate-claim");

  const config = claimConfig(claimType);
  const onFieldChange = useCallback((id: string, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  }, []);

  const missingFieldLabels = useMemo(
    () =>
      config.fields
        .filter(
          (f) => f.required && fieldVisible(f, values) && !values[f.id]?.trim()
        )
        .map((f) => f.label),
    [config.fields, values]
  );

  const missingDocs = useMemo(
    () =>
      documents
        .filter(
          (d) =>
            d.addedBy !== "LENDER" && d.required && d.active && outstanding(d)
        )
        .map((d) => d.name),
    [documents]
  );
  const canSubmit = missingDocs.length === 0 && missingFieldLabels.length === 0;

  // Back to the claims grid as the lender left it — same filter, not the unfiltered list.
  const rememberedBackHref = useRememberedHref(backHref, CLAIMS_FILTER_KEY);

  const resubmitting = status === "QUERY_RAISED";
  const locked =
    status === "APPROVED" ||
    status === "REJECTED" ||
    status === "CLOSED" ||
    status === "REFUND_RECEIVED_BY_IMGC";

  // A draft's uploads only count once Save Draft (or Save & Submit) keeps them. The server marks
  // them unsaved; leaving Initiate Claim — another tab, Back, Cancel — drops them, and so does
  // opening the screen again after a refresh or a closed tab.
  const isDraft = status === "DRAFT";
  const discardUnsaved = useCallback(() => {
    if (!isDraft) return;
    void discardUnsavedUploadsAction(accountId, claimId)
      .then(() => router.refresh())
      .catch(() => {
        // Best effort — the page drops unsaved uploads again on the next open.
      });
  }, [isDraft, accountId, claimId, router]);

  // While this screen is open, its own refreshes keep the unsaved uploads (the page drops them on
  // any other load). Cleared on leaving — in-app navigation or a browser refresh/close.
  useEffect(() => {
    if (!isDraft) return;
    const clear = () => {
      document.cookie =
        "imgc-draft-open=; path=/; max-age=0; secure; samesite=lax";
    };
    document.cookie = `imgc-draft-open=${claimId}; path=/; secure; samesite=lax`;
    window.addEventListener("pagehide", clear);
    return () => {
      window.removeEventListener("pagehide", clear);
      clear();
      discardUnsaved();
    };
  }, [isDraft, claimId, discardUnsaved]);

  const footerMessage = canSubmit ? (
    <p className="flex items-center gap-1.5 font-medium text-success-700">
      <CheckCircle2Icon className="size-4" />
      {t(resubmitting ? "footer.readyToResubmit" : "footer.readyToSubmit")}
    </p>
  ) : null;

  const onSave = useCallback(() => {
    startTransition(async () => {
      const result = await saveDraftAction(accountId, claimId, values);
      if (!result.ok) {
        toast.error(errorText(result) ?? t("toast.saveFailed"));
        return;
      }
      toast.success(t("toast.saved"));
    });
  }, [accountId, claimId, values, t, errorText]);

  const onSubmit = useCallback(() => {
    startTransition(async () => {
      const result = await submitClaimAction(accountId, claimId, values);
      if (!result.ok) {
        toast.error(errorText(result) ?? t("toast.submitFailed"));
        return;
      }
      toast.success(
        t(resubmitting ? "toast.resubmitted" : "toast.submitted", {
          claimNo: result.claimNo || claimNo,
        })
      );
      // Away from the workspace, not a refresh-in-place: the claim is now with IMGC, so there is
      // nothing left to do here until a query brings it back. Re-opening it (Continue/Track) picks
      // up wherever it actually stands, rather than leaving this same Save & Submit bar sitting on
      // screen looking clickable right after a successful submission.
      // Return to the grid sorted by Last Updated descending so the newly submitted
      // claim (lastUpdatedAt = now) appears at the top of page 1 immediately.
      const backWithSort = backHref.includes("?")
        ? `${backHref}&sort=lastUpdatedAt_desc`
        : `${backHref}?sort=lastUpdatedAt_desc`;
      router.push(backWithSort);
    });
  }, [
    accountId,
    backHref,
    claimId,
    claimNo,
    resubmitting,
    router,
    values,
    t,
    errorText,
  ]);

  const onCancel = useCallback(() => {
    router.push(backHref);
  }, [backHref, router]);

  return (
    <div className="space-y-2">
      {openQuery && <QueryBanner query={openQuery} />}

      {/* ── Tab bar row: Back link + underline tabs on one line ── */}
      <div className="flex items-center gap-3 border-b border-neutral-200">
        <Link
          href={rememberedBackHref}
          className="-mb-px inline-flex shrink-0 items-center gap-1 border-b-2 border-transparent py-2.5 text-ui-body-lg font-medium text-neutral-400 hover:text-neutral-700 transition-colors"
        >
          <ArrowLeftIcon className="size-3" /> Back
        </Link>
        <div
          className="flex flex-wrap gap-1"
          role="tablist"
          aria-label={t("sectionsLabel")}
        >
          {(["loan-details", "initiate-claim"] as WorkspaceTab[]).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => {
                // Leaving Initiate Claim drops whatever Save Draft never kept.
                if (id !== "initiate-claim" && activeTab === "initiate-claim") {
                  discardUnsaved();
                }
                setActiveTab(id);
              }}
              className={cn(
                "-mb-px border-b-2 px-3.5 py-2.5 text-ui-subhead-lg font-medium transition-colors",
                activeTab === id
                  ? "border-brand-primary text-brand-primary"
                  : "border-transparent text-neutral-500 hover:text-neutral-800"
              )}
            >
              {t(
                id === "loan-details"
                  ? "tabs.loanDetails"
                  : "tabs.initiateClaim"
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Loan Details tab ────────────────────────────────── */}
      {activeTab === "loan-details" && <LoanDetailsCard account={account} />}

      {/* ── Initiate Claim tab — single column, viewport-fit ── */}
      {activeTab === "initiate-claim" && (
        <div className="flex flex-col gap-3 pb-4">
          {/* Document + remarks area */}
          <div className="flex-1 pr-0.5">
            <ClaimDocuments
              accountId={accountId}
              claimId={claimId}
              documents={documents}
              locked={locked}
              allowDelete={status === "DRAFT"}
              variant="table"
              claimStatus={status}
            />

            <Panel title={t("remarks.title")} className="mt-3">
              <div className="px-4 py-3">
                <textarea
                  value={values.__initiationRemark ?? ""}
                  maxLength={INITIATION_REMARK_MAX}
                  disabled={locked || pending}
                  onChange={(event) =>
                    onFieldChange("__initiationRemark", event.target.value)
                  }
                  rows={2}
                  placeholder={t("remarks.placeholder")}
                  className="w-full resize-y rounded-lg border border-neutral-200 px-3 py-2 text-ui-subhead outline-none transition-colors focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:bg-neutral-50 disabled:text-neutral-400"
                />
                <p className="mt-1 text-right text-ui-label text-neutral-400">
                  {t("remarks.counter", {
                    used: (values.__initiationRemark ?? "").length,
                    max: INITIATION_REMARK_MAX,
                  })}
                </p>
              </div>
            </Panel>
          </div>

          {/* Pinned action bar */}
          {!locked && (
            <ActionFooter message={footerMessage}>
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={pending}
              >
                <XIcon /> {t("actions.cancel")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onSave}
                disabled={pending}
              >
                <SaveIcon /> {t("actions.saveDraft")}
              </Button>
              {/* Offered only once every mandatory document is in — hidden, not greyed out. */}
              {canSubmit && (
                <Button size="sm" onClick={onSubmit} disabled={pending}>
                  <SendIcon />{" "}
                  {t(resubmitting ? "actions.resubmit" : "actions.submit")}
                </Button>
              )}
            </ActionFooter>
          )}
        </div>
      )}
    </div>
  );
}

/** What IMGC asked for, and what the lender has to do about it. */
function QueryBanner({ query }: Readonly<{ query: ClaimQuery }>) {
  const t = useTranslations("claimWorkspace.query");
  return (
    <section className="rounded-xl border border-warning/40 bg-warning/8 px-5 py-4">
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <MessageSquareWarningIcon className="size-4 text-warning" />
        <h2 className="text-ui-lead font-semibold text-neutral-950">
          {t("title")}
        </h2>
        <span className="text-ui-body text-neutral-600">
          {t("raisedBy", {
            name: query.raisedByName,
            date: new Date(query.raisedAt).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }),
          })}
        </span>
      </header>

      <dl className="space-y-1.5 text-ui-subhead">
        <div className="flex gap-2">
          <dt className="shrink-0 font-semibold text-neutral-700">
            {t("reason")}
          </dt>
          <dd className="text-neutral-800">{query.reason}</dd>
        </div>
        {query.remarks && (
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-neutral-700">
              {t("remarks")}
            </dt>
            <dd className="text-neutral-700">{query.remarks}</dd>
          </div>
        )}
        {query.requestedDocuments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <dt className="shrink-0 font-semibold text-neutral-700">
              {t("requiredAction")}
            </dt>
            <dd className="flex flex-wrap gap-1.5">
              {query.requestedDocuments.map((name) => (
                <span
                  key={name}
                  className="rounded-full bg-white px-2.5 py-0.5 text-ui-body-sm font-medium text-neutral-800 ring-1 ring-warning/40"
                >
                  {t("uploadDocument", { name })}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
