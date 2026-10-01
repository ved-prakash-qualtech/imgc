import { useTranslations } from "next-intl";

import { cn } from "@imgc/lib/utils/twMergeUtils";
import type { FileReview } from "@imgc/types/domain";

/**
 * IMGC's decision on one file and the remark behind it, shown under the file name.
 *
 * The same line on both sides: IMGC sees what they recorded, and the lender sees why a file was
 * accepted or rejected without anyone having to relay it. Nothing renders for a file that has
 * not been decided yet.
 */
/** Cuts text to `max` characters with "..." — the full text goes in the element's tooltip. */
export function clip(text: string, max?: number): string {
  return max && text.length > max ? `${text.slice(0, max).trimEnd()}...` : text;
}

export function FileDecisionNote({
  review,
  className,
  maxChars,
}: Readonly<{
  review?: FileReview;
  className?: string;
  /** Cap the remark's visible length (the "Accepted:"/"Rejected:" label is not counted). */
  maxChars?: number;
}>) {
  const t = useTranslations("claimDocuments.decisionNote");
  if (!review) return null;
  const accepted = review.decision === "APPROVED";
  const decision = t(accepted ? "accepted" : "rejected");
  return (
    <p
      className={cn(
        "mt-0.5 line-clamp-2 text-ui-label font-normal leading-snug",
        accepted ? "text-success-700" : "text-destructive",
        className
      )}
      title={t("title", {
        decision,
        name: review.byName,
        remarks: review.remarks,
      })}
    >
      <span className="font-semibold">{decision}:</span>{" "}
      {clip(review.remarks, maxChars)}
    </p>
  );
}

/**
 * What the lender wrote when uploading this file, shown to IMGC under the file name.
 *
 * It is the lender's context for the reviewer — "page 3 is the one that matters", "statement
 * for the co-borrower" — and it belongs next to the file it describes, where the decision on
 * that file is taken, rather than somewhere IMGC has to go looking for it.
 */
export function LenderRemarkNote({
  remarks,
  className,
}: Readonly<{ remarks?: string; className?: string }>) {
  const text = remarks?.trim();
  if (!text) return null;
  return (
    <p
      className={cn(
        "mt-0.5 line-clamp-2 text-ui-label font-normal leading-snug text-neutral-500",
        className
      )}
      title={`Lender remark: ${text}`}
    >
      <span className="font-semibold text-neutral-600">Lender remark:</span>{" "}
      {text}
    </p>
  );
}
