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
  ["WAIVER_REQUESTED", "bg-warning/15 text-warning"],
  ["WAIVED", "bg-brand-muted text-brand-dark"],
  // claims
  ["DRAFT", "bg-neutral-100 text-neutral-600"],
  ["NOT_STARTED", "bg-neutral-100 text-neutral-600"],
  ["SUBMITTED", "bg-info/12 text-info"],
  ["APPROVED", "bg-success/15 text-success-700"],
  ["ACCEPTED", "bg-success/15 text-success-700"],
  ["QUERIED", "bg-warning/15 text-warning"],
  // claim lifecycle
  ["UNDER_REVIEW", "bg-info/12 text-info"],
  ["QUERY_RAISED", "bg-warning/15 text-warning"],
  ["QUERY_INITIATED", "bg-warning/15 text-warning"],
  ["QUERY_UNDER_REVIEW", "bg-warning/15 text-warning"],
  ["INITIATED", "bg-info/12 text-info"],
  ["DOCUMENTS_RESUBMITTED", "bg-brand-muted text-brand-dark"],
  ["CLOSED", "bg-neutral-200 text-neutral-700"],
  ["REFUND_RECEIVED_BY_IMGC", "bg-brand-muted text-brand-dark"],
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
  ["REJECTED", "Ineligible"],
  ["WAIVER_REQUESTED", "Waiver requested"],
  ["WAIVED", "Waived"],
  ["DRAFT", "Draft"],
  ["NOT_STARTED", "Not started"],
  ["SUBMITTED", "Submitted"],
  ["APPROVED", "Approved"],
  ["ACCEPTED", "Accepted"],
  ["QUERIED", "Queried"],
  ["QUERY_RAISED", "Query raised"],
  ["QUERY_INITIATED", "Query Initiated"],
  ["QUERY_UNDER_REVIEW", "Query Under Review"],
  ["INITIATED", "Initiated"],
  ["DOCUMENTS_RESUBMITTED", "Docs resubmitted"],
  ["CLOSED", "Closed"],
  ["REFUND_RECEIVED_BY_IMGC", "Refund Received by IMGC"],
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

/** Every `TONES` entry is "bg-* text-*" — pull just the text color back out for `flat`. */
function textToneOf(tone: string): string {
  return (
    tone.split(" ").find((cls) => cls.startsWith("text-")) ?? "text-neutral-600"
  );
}

export function StatusPill({
  status,
  className,
  maxChars,
  flat = false,
}: Readonly<{
  status: DocStatus | ClaimStatus | Bucket | string;
  className?: string;
  /** Cap the visible label (e.g. in a narrow grid column); the full label moves to a tooltip. */
  maxChars?: number;
  /**
   * Plain colored text, no pill background and no dot — for a dense, non-interactive table
   * column where a full pill costs more width than the status is worth. Never use this on
   * something clickable: a flat label carries no visual affordance that it's a button, which the
   * bg-filled pill (deliberately) does.
   */
  flat?: boolean;
}>) {
  const label = LABELS.get(status) ?? status;
  const clipped =
    maxChars && label.length > maxChars
      ? `${label.slice(0, maxChars).trimEnd()}...`
      : label;
  const tone = TONES.get(status) ?? "bg-neutral-100 text-neutral-600";
  const title = clipped !== label ? label : undefined;

  if (flat) {
    return (
      <span
        className={cn(
          "text-[11.5px] font-semibold whitespace-nowrap",
          textToneOf(tone),
          className
        )}
        title={title}
      >
        {clipped}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap",
        tone,
        className
      )}
      title={title}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {clipped}
    </span>
  );
}
