import { cn } from "@/utils/cn";

/**
 * Default status → utility-class map. Keys are matched case-sensitively;
 * unknown statuses fall back to a neutral tone. Callers can extend or
 * override via the `toneMap` prop.
 */
const DEFAULT_MAP: Record<string, string> = {
  // success
  Active: "bg-success/15 text-success",
  Approved: "bg-success/15 text-success",
  Operational: "bg-success/15 text-success",
  Published: "bg-success/15 text-success",
  Verified: "bg-success/15 text-success",
  Completed: "bg-success/15 text-success",
  // pending / warning
  Pending: "bg-warning/15 text-warning",
  "Pending Approval": "bg-warning/15 text-warning",
  "Pending Invite": "bg-warning/15 text-warning",
  // info / in-progress
  "In Review": "bg-info/15 text-info",
  "In Configuration": "bg-info/15 text-info",
  Draft: "bg-muted text-muted-foreground",
  // changes requested
  "Changes Requested": "bg-orange-500/15 text-orange-600",
  // escalated / locked
  Escalated: "bg-purple-500/15 text-purple-600",
  Locked: "bg-purple-500/15 text-purple-600",
  // negative
  Rejected: "bg-destructive/15 text-destructive",
  Suspended: "bg-destructive/15 text-destructive",
  Failed: "bg-destructive/15 text-destructive",
  // neutral
  Inactive: "bg-muted text-muted-foreground",
  Expired: "bg-muted text-muted-foreground",
  Archived: "bg-muted text-muted-foreground",
};

const NEUTRAL = "bg-muted text-muted-foreground";

/** Built once. A caller's own map is converted per call, which is the rarer path. */
const DEFAULT_TONES = new Map(Object.entries(DEFAULT_MAP));

/**
 * The tone classes for one status, or a neutral pill for a status nobody has picked a tone for.
 *
 * Looked up through a Map rather than indexing the object: `status` arrives from the backend, and
 * a computed index on a plain object also reaches what it inherits — `constructor`, `toString` —
 * none of which are tones, all of which would end up in a className.
 */
export function statusBadgeClass(
  status: string,
  toneMap?: Record<string, string>
): string {
  const tones = toneMap ? new Map(Object.entries(toneMap)) : DEFAULT_TONES;
  return tones.get(status) ?? NEUTRAL;
}

/**
 * StatusBadge
 *
 * Generic status pill with a coloured dot. Maps a status label to a tone
 * via the default map (extensible through `toneMap`).
 */
export function StatusBadge({
  status,
  toneMap,
  showDot = true,
  className,
}: {
  status: string;
  toneMap?: Record<string, string>;
  showDot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        statusBadgeClass(status, toneMap),
        className
      )}
    >
      {showDot && (
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      )}
      {status}
    </span>
  );
}
