/** "₹4.62 Cr" / "₹7.35 L" — the short scale the KPI tiles use. */
function crore(amount: number): string {
  if (amount >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2)} Cr`;
  if (amount >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(2)} L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

const exact = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Claim totals beside "Overview", on the band's dark ground. */
export function OverviewTotals({
  totals,
}: Readonly<{
  totals: { total: number; approved: number; rejected: number };
}>) {
  const items = [
    ["Total Claim Amount", totals.total],
    ["Approved Amount", totals.approved],
    ["Ineligible Amount", totals.rejected],
  ] as const;
  return (
    <div className="flex items-center gap-4">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="leading-tight"
          title={`${label}: ₹${exact.format(value)}`}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-[10px] font-medium text-white/60">{label}</p>
            {(label === "Approved Amount" || label === "Ineligible Amount") && (
              <span className="rounded bg-brand-primary/20 px-1 py-[1px] text-[7.5px] font-bold uppercase tracking-wider text-[#ffc48a] border border-brand-primary/30">
                CFY
              </span>
            )}
          </div>
          <p className="text-[13px] font-semibold tabular-nums text-white">
            {crore(value)}
          </p>
        </div>
      ))}
    </div>
  );
}
