/**
 * Days Past Due — shared formatting/classification, so the account listing, the claim grid and
 * the dedicated DPD screen never define this differently from each other.
 *
 * DPD is a collections metric on the account, independent of `npa`/`writeOff` — never inferred
 * from either, and never used to change claim-eligibility rules (`getClaimAction` alone decides
 * that, unchanged).
 */

export const DPD_BANDS = ["ALL", "0", "1-30", "31-60", "61-90", "90+"] as const;
export type DpdBand = (typeof DPD_BANDS)[number];

export const DPD_BAND_LABEL: Record<DpdBand, string> = {
  ALL: "All",
  "0": "0 Days",
  "1-30": "1–30 Days",
  "31-60": "31–60 Days",
  "61-90": "61–90 Days",
  "90+": "90+ Days",
};

/** Whichever band a DPD value falls into — `null` (no band) only when DPD itself is missing. */
export function dpdBandOf(dpd: number | undefined): DpdBand | null {
  if (dpd === undefined || dpd === null || Number.isNaN(dpd)) return null;
  if (dpd === 0) return "0";
  if (dpd <= 30) return "1-30";
  if (dpd <= 60) return "31-60";
  if (dpd <= 90) return "61-90";
  return "90+";
}

export function dpdInBand(dpd: number | undefined, band: DpdBand): boolean {
  if (band === "ALL") return true;
  return dpdBandOf(dpd) === band;
}

/** "36 Days", "0 Days", or "—" for a missing value — never `undefined`/`null`/`NaN` on screen. */
export function formatDpd(dpd: number | undefined): string {
  if (dpd === undefined || dpd === null || Number.isNaN(dpd)) return "—";
  return `${dpd} Day${dpd === 1 ? "" : "s"}`;
}
