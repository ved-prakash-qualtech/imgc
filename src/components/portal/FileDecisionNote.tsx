import { cn } from "@/lib/utils/twMergeUtils";
import type { FileReview } from "@/server/mock/types";

/**
 * IMGC's decision on one file and the remark behind it, shown under the file name.
 *
 * The same line on both sides: IMGC sees what they recorded, and the lender sees why a file was
 * accepted or rejected without anyone having to relay it. Nothing renders for a file that has
 * not been decided yet.
 */
export function FileDecisionNote({
  review,
  className,
}: Readonly<{ review?: FileReview; className?: string }>) {
  if (!review) return null;
  const accepted = review.decision === "APPROVED";
  return (
    <p
      className={cn(
        "mt-0.5 line-clamp-2 text-[11px] font-normal leading-snug",
        accepted ? "text-success-700" : "text-destructive",
        className
      )}
      title={`${accepted ? "Accepted" : "Rejected"} by ${review.byName}: ${review.remarks}`}
    >
      <span className="font-semibold">{accepted ? "Accepted" : "Rejected"}:</span>{" "}
      {review.remarks}
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
        "mt-0.5 line-clamp-2 text-[11px] font-normal leading-snug text-neutral-500",
        className
      )}
      title={`Lender remark: ${text}`}
    >
      <span className="font-semibold text-neutral-600">Lender remark:</span> {text}
    </p>
  );
}
