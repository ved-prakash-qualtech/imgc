import { cn } from "@/lib/utils/twMergeUtils";
import type { Bucket, ClaimStatus, DocStatus } from "@/server/mock/types";

/**
 * One pill for every status the portal shows. A Map rather than an object index: statuses arrive
 * from stored data, and a computed index on a plain object also reaches what it inherits.
 */
const TONES = new Map<string, string>([
  // documents
  ["NOT_REQUESTED", "bg-neutral-50 text-neutral-400"],
  ["PENDING_UPLOAD", "bg-neutral-100 text-neutral-600"],
  ["UNDER_REVIEW", "bg-info/12 text-info"],
  ["REUPLOAD_REQUIRED", "bg-warning/15 text-warning"],
  ["REJECTED", "bg-destructive/12 text-destructive"],
  // claims
  ["DRAFT", "bg-neutral-100 text-neutral-600"],
  ["SUBMITTED", "bg-info/12 text-info"],
  ["APPROVED", "bg-success/15 text-success-700"],
  ["QUERIED", "bg-warning/15 text-warning"],
  // case document completion
  ["COMPLETE", "bg-success/15 text-success-700"],
  ["INCOMPLETE", "bg-warning/15 text-warning"],
  // priority
  ["URGENT", "bg-destructive/12 text-destructive"],
  ["HIGH", "bg-warning/15 text-warning"],
  ["NORMAL", "bg-neutral-100 text-neutral-600"],
  ["LOW", "bg-neutral-50 text-neutral-400"],
  // buckets
  ["IMGC", "bg-brand-muted text-brand-dark"],
  ["LENDER", "bg-warning/15 text-warning"],
  // reinstatement
  ["REQUESTED", "bg-warning/15 text-warning"],
  ["DENIED", "bg-destructive/12 text-destructive"],
]);

const LABELS = new Map<string, string>([
  ["NOT_REQUESTED", "Not requested"],
  ["PENDING_UPLOAD", "Pending upload"],
  ["UNDER_REVIEW", "Under review"],
  ["REUPLOAD_REQUIRED", "Re-upload required"],
  ["REJECTED", "Rejected"],
  ["DRAFT", "Draft"],
  ["SUBMITTED", "Submitted"],
  ["APPROVED", "Approved"],
  ["QUERIED", "Queried"],
  ["COMPLETE", "Documents complete"],
  ["INCOMPLETE", "Documents incomplete"],
  ["URGENT", "Urgent"],
  ["HIGH", "High"],
  ["NORMAL", "Normal"],
  ["LOW", "Low"],
  ["IMGC", "IMGC"],
  ["LENDER", "Lender"],
  ["REQUESTED", "Reinstate requested"],
  ["DENIED", "Reinstate denied"],
]);

export function StatusPill({
  status,
  className,
}: Readonly<{
  status: DocStatus | ClaimStatus | Bucket | string;
  className?: string;
}>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap",
        TONES.get(status) ?? "bg-neutral-100 text-neutral-600",
        className
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {LABELS.get(status) ?? status}
    </span>
  );
}
