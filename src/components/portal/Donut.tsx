/**
 * Small progress ring. Pure SVG — no chart library for a single arc, and it renders on the
 * server with the rest of the card.
 */
/** Ring color — same semantic tokens used across the KPI tiles, so a card's donut, icon chip
 *  and value all agree on what the number means (risk, in-flight, healthy). */
const DONUT_STROKE = {
  brand: "var(--brand-primary)",
  danger: "var(--color-destructive)",
  info: "var(--color-info)",
  success: "var(--color-success)",
} as const;

export function Donut({
  value,
  total,
  size = 56,
  stroke = 7,
  tone = "brand",
}: Readonly<{
  value: number;
  total: number;
  size?: number;
  stroke?: number;
  tone?: keyof typeof DONUT_STROKE;
}>) {
  const safeTotal = total > 0 ? total : 1;
  const pct = Math.min(1, Math.max(0, value / safeTotal));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${value} of ${total}`}
      className="shrink-0"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-neutral-200)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={DONUT_STROKE[tone]}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - pct)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
