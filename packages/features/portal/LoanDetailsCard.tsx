"use client";

import { useTranslations } from "next-intl";

import { Panel } from "@imgc/features/portal/Panel";
import type { AccountRow } from "@imgc/data/services/portal/accounts.server";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function date(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function years(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y} yr ${m} mo` : `${y} years`;
}

/** IMGC approval typically precedes disbursement. Return disbursementDate − 45 days. */
function imgcApprovalDate(disbursementIso: string): string {
  const d = new Date(disbursementIso);
  d.setDate(d.getDate() - 45);
  return d.toISOString().slice(0, 10);
}

function Row({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-1.5 odd:bg-neutral-25">
      <dt className="text-ui-body text-neutral-500">{label}</dt>
      <dd className="text-right text-ui-body-lg font-medium whitespace-nowrap text-neutral-900">
        {value}
      </dd>
    </div>
  );
}

/**
 * The loan behind the claim, from mock account data — read only.
 *
 * No inputs, no edit control: the lender cannot change loan information, and there is no second
 * editable copy of it anywhere. Open a different account and the corresponding loan loads here.
 */
export function LoanDetailsCard({
  account,
}: Readonly<{ account: AccountRow }>) {
  const t = useTranslations("claim.loanDetails");
  const orderedFields = (
    <>
      {/* Row 1 */}
      <Row label={t("lender")} value={account.lenderOrgName} />
      <Row
        label={t("emiAmount")}
        value={inr.format(25000 + (account.loanAmount % 5000))}
      />
      {/* Row 2 */}
      <Row label={t("loanAccountNumber")} value={account.loanNo} />
      <Row
        label={t("dpd")}
        value={account.dpd !== undefined ? String(account.dpd) : "—"}
      />
      {/* Row 3 */}
      <Row label={t("customerName")} value={account.borrowerName} />
      <Row label={t("npa")} value={t("yes")} />
      {/* Row 4 */}
      <Row label={t("propertyType")} value={account.propertyType} />
      <Row label={t("product")} value={account.product} />
      {/* Row 5 */}
      <Row label={t("propertyStatus")} value={account.propertyStatus} />
      <Row
        label={t("disbursementDate")}
        value={date(account.disbursementDate)}
      />
      {/* Row 6 */}
      <Row label={t("loanAmount")} value={inr.format(account.loanAmount)} />
      <Row
        label={t("imgcApprovalDate")}
        value={date(imgcApprovalDate(account.disbursementDate))}
      />
      {/* Row 7 */}
      <Row
        label={t("outstandingAmount")}
        value={inr.format(account.outstandingAmount)}
      />
      <Row label={t("tenure")} value={years(account.tenureMonths)} />
    </>
  );

  return (
    <Panel title={t("title")}>
      <dl className="grid sm:grid-cols-2">{orderedFields}</dl>
    </Panel>
  );
}
