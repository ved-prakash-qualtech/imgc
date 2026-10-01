const formatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
});

/** Amount in minor units (e.g. cents). */
export function formatCurrency(amountCents: number): string {
  return formatter.format(amountCents / 100);
}
