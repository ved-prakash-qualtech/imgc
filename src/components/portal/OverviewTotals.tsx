import { useTranslations } from "next-intl";

/** "₹4.62 Cr" / "₹7.35 L" — the short scale the KPI tiles use. */
function crore(amount: number): string {
  if (amount >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2)} Cr`;
  if (amount >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(2)} L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

const exact = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Claim totals beside "Overview", on the band's dark ground. */
export function OverviewTotals({
  total,
  approved,
  rejected,
}: Readonly<{
  total: number;
  approved: number;
  rejected: number;
}>) {
  const t = useTranslations("dashboard");
  // The CFY marker follows the entry, not its wording — comparing rendered labels broke the
  // moment they were translated.
  const items = [
    {
      key: "total",
      label: t("totalClaimAmount"),
      value: total,
      currentYear: false,
    },
    {
      key: "approved",
      label: t("approvedAmount"),
      value: approved,
      currentYear: true,
    },
    {
      key: "rejected",
      label: t("ineligibleAmount"),
      value: rejected,
      currentYear: true,
    },
  ];

  return (
    <div className="flex items-center gap-4">
      {items.map(({ key, label, value, currentYear }) => (
        <div
          key={key}
          className="leading-tight"
          title={`${label}: ₹${exact.format(value)}`}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-ui-tiny font-medium text-white/60">{label}</p>
            {currentYear && (
              <span className="rounded bg-brand-primary/20 px-1 py-[1px] text-ui-pico font-bold uppercase tracking-wider text-brand-on-dark border border-brand-primary/30">
                CFY
              </span>
            )}
          </div>
          <p className="text-ui-subhead font-semibold tabular-nums text-white">
            {crore(value)}
          </p>
        </div>
      ))}
    </div>
  );
}
