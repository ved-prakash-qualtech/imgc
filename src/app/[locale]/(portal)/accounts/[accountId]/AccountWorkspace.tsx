"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setClaimStatusAction } from "@/app/[locale]/(portal)/accounts/[accountId]/actions";
import { AccountingValuesTab } from "@/app/[locale]/(portal)/accounts/[accountId]/AccountingValuesTab";
import { AuditTrailTab } from "@/app/[locale]/(portal)/accounts/[accountId]/AuditTrailTab";
import { InitialClaimsTab } from "@/app/[locale]/(portal)/accounts/[accountId]/InitialClaimsTab";
import { RemarksTab } from "@/app/[locale]/(portal)/accounts/[accountId]/RemarksTab";
import { BucketToggle } from "@/components/portal/BucketToggle";
import { Panel } from "@/components/portal/Panel";
import { StatusPill } from "@/components/portal/StatusPill";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/twMergeUtils";
import type { AccountRow } from "@/services/portal/accounts.server";
import type { DocumentRow } from "@/services/portal/claims.server";
import type { AuditEvent, PasValue, Remark, Role } from "@/server/mock/types";

const TABS = [
  "Overview",
  "Accounting Values",
  "Initial Claims",
  "Remarks",
  "Audit Trail",
] as const;

type Props = Readonly<{
  account: AccountRow;
  role: Role;
  docs: DocumentRow[];
  pasValues: PasValue[];
  remarks: Remark[];
  events: AuditEvent[];
  canSubmit: boolean;
  retentionDays: number;
}>;

export function AccountWorkspace({
  account,
  role,
  docs,
  pasValues,
  remarks,
  events,
  canSubmit,
  retentionDays,
}: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");

  const documentNames = Object.fromEntries(docs.map((d) => [d.id, d.name]));

  return (
    <div>
      <div
        className="mb-5 flex flex-wrap gap-1 border-b border-neutral-200"
        role="tablist"
        aria-label="Account sections"
      >
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className={cn(
              "-mb-px border-b-2 px-3.5 py-2.5 text-[13.5px] font-medium transition-colors",
              tab === name
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            )}
          >
            {name}
            {name === "Initial Claims" && (
              <span
                className={cn(
                  "ml-1.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold",
                  docs.filter((d) => d.required && d.status === "PENDING_UPLOAD").length > 0
                    ? "bg-warning/15 text-warning"
                    : "bg-success/15 text-success-700"
                )}
              >
                {docs.filter((d) => d.status === "UNDER_REVIEW" || d.status === "APPROVED").length}
                /{docs.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "Overview" && <OverviewTab account={account} role={role} />}
      {tab === "Accounting Values" && (
        <AccountingValuesTab accountId={account.id} values={pasValues} />
      )}
      {tab === "Initial Claims" && (
        <InitialClaimsTab
          accountId={account.id}
          accountProduct={account.product}
          role={role}
          docs={docs}
          claimStatus={account.claimStatus}
          canSubmit={canSubmit}
          retentionDays={retentionDays}
        />
      )}
      {tab === "Remarks" && (
        <RemarksTab
          accountId={account.id}
          remarks={remarks}
          documentNames={documentNames}
        />
      )}
      {tab === "Audit Trail" && <AuditTrailTab events={events} />}
    </div>
  );
}

/* ── Overview ──────────────────────────────────────────────────────── */

function Fact({ label, value }: Readonly<{ label: string; value: React.ReactNode }>) {
  return (
    <div className="px-5 py-3.5">
      <p className="text-[11.5px] font-medium uppercase tracking-wide text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-[13.5px] font-medium text-neutral-900">{value}</p>
    </div>
  );
}

function OverviewTab({
  account,
  role,
}: Readonly<{ account: AccountRow; role: Role }>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");

  const decide = useCallback(
    (status: "APPROVED" | "QUERIED") => {
      startTransition(async () => {
        const result = await setClaimStatusAction(account.id, status, note);
        if (!result.ok) {
          toast.error(result.error ?? "That status could not be set.");
          return;
        }
        setNote("");
        toast.success(`Claim marked ${status.toLowerCase()}.`);
        router.refresh();
      });
    },
    [account.id, note, router]
  );

  return (
    <div className="space-y-4">
      <Panel
        title="Account"
        description={
          role === "IMGC"
            ? account.bucket === "IMGC"
              ? "In the IMGC bucket. Hand it back once the lender has more to do."
              : "With the lender. Pull it into the IMGC bucket to process it."
            : undefined
        }
        actions={
          role === "IMGC" ? (
            <BucketToggle
              accountId={account.id}
              loanNo={account.loanNo}
              bucket={account.bucket}
            />
          ) : null
        }
      >
        <div className="grid divide-y divide-neutral-100 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
          <Fact label="Loan number" value={account.loanNo} />
          <Fact label="Borrower" value={account.borrowerName} />
          <Fact label="Lender" value={account.lenderOrgName} />
          <Fact label="Product" value={account.product} />
          <Fact label="Processing bucket" value={<StatusPill status={account.bucket} />} />
          <Fact label="Claim status" value={<StatusPill status={account.claimStatus} />} />
          <Fact label="Stage" value={account.stage} />
          <Fact
            label="Documents in"
            value={`${account.requiredDocs - account.pendingDocs} of ${account.requiredDocs} mandatory`}
          />
        </div>
      </Panel>

      {role === "IMGC" && (
        <Panel
          title="Processing outcome"
          description="Processing itself happens in PAS. Record the outcome here so the lender can see it."
        >
          <div className="flex flex-wrap items-end gap-3 px-5 py-4">
            <label className="min-w-[280px] flex-1">
              <span className="mb-1 block text-[12.5px] font-medium text-neutral-700">
                Note (optional)
              </span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Valuation clarified with the lender on call"
                className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              />
            </label>
            <Button
              size="sm"
              variant="success"
              onClick={() => decide("APPROVED")}
              disabled={pending}
            >
              Mark approved
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => decide("QUERIED")}
              disabled={pending}
            >
              Raise a query
            </Button>
          </div>
        </Panel>
      )}

      {account.pushRecipients.length > 0 && (
        <Panel title="Notification recipients">
          <p className="px-5 py-4 text-[13px] text-neutral-600">
            {account.pushRecipients.join(", ")}
          </p>
        </Panel>
      )}
    </div>
  );
}
