/** "₹4.62 Cr" / "₹7.35 L" — the short scale the KPI tiles use. */
function crore(amount: number): string {
  if (amount >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2)} Cr`;
  if (amount >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(2)} L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

const exact = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Loan, O/S and claim totals in the Overview header, on the band's dark ground. */
export function OverviewTotals({
  totals,
}: Readonly<{ totals: { loan: number; outstanding: number; claim: number } }>) {
  const items = [
    ["Loan Amount", totals.loan],
    ["O/S Amount", totals.outstanding],
    ["Claim Amount", totals.claim],
  ] as const;
  return (
    <div className="flex items-center gap-4">
      {items.map(([label, value]) => (
        <div key={label} className="leading-tight" title={`${label}: ₹${exact.format(value)}`}>
          <p className="text-[10px] font-medium text-white/60">{label}</p>
          <p className="text-[13px] font-semibold tabular-nums text-white">{crore(value)}</p>
        </div>
      ))}
    </div>
  );
}
