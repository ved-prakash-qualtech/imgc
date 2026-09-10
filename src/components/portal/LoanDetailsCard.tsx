import { Panel } from "@/components/portal/Panel";
import type { AccountRow } from "@/services/portal/accounts.server";

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
      <dt className="text-[12px] text-neutral-500">{label}</dt>
      <dd className="text-right text-[12.5px] font-medium whitespace-nowrap text-neutral-900">
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
  return (
    <Panel title="Loan details">
      <dl className="grid sm:grid-cols-2">
        <Row label="Loan Account Number" value={account.loanNo} />
        <Row label="Customer Name" value={account.borrowerName} />
        <Row label="Product" value={account.product} />
        <Row label="Loan Amount" value={inr.format(account.loanAmount)} />
        <Row
          label="Outstanding Amount"
          value={inr.format(account.outstandingAmount)}
        />
        <Row label="Disbursement Date" value={date(account.disbursementDate)} />
        <Row label="Tenure" value={years(account.tenureMonths)} />
        <Row label="Property Type" value={account.propertyType} />
        <Row label="Property Status" value={account.propertyStatus} />
        <Row
          label="IMGC Approval Date"
          value={date(imgcApprovalDate(account.disbursementDate))}
        />
      </dl>
    </Panel>
  );
}
