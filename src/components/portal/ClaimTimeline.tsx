import { ClaimStatusGraph } from "@/components/portal/ClaimStatusGraph";
import { StatusPill } from "@/components/portal/StatusPill";
import { cn } from "@/lib/utils/twMergeUtils";
import type {
  ClaimStatus,
  ClaimStatusEntry,
  ClaimTypeKey,
} from "@/server/mock/types";

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Where a claim has got to, and how it got there.
 *
 * Both halves are derived: the rail comes from the claim type's configured `statusFlow`, and the
 * entries come from the claim's own history. Nothing here lists statuses of its own, so a new
 * claim type or a changed flow needs no edit to this file.
 */
export function ClaimTimeline({
  claimType,
  status,
  history,
}: Readonly<{
  claimType: ClaimTypeKey;
  status: ClaimStatus;
  history: readonly ClaimStatusEntry[];
}>) {
  return (
    <div className="space-y-5">
      <ClaimStatusGraph claimType={claimType} status={status} />

      {/* ── What actually happened ──────────────────────────── */}
      <ol className="relative space-y-3 border-l border-neutral-200 pl-5">
        {[...history].reverse().map((entry, i) => (
          <li key={`${entry.status}-${entry.at}-${i}`} className="relative">
            <span
              className={cn(
                "absolute -left-[26px] top-1 grid size-3 place-items-center rounded-full ring-4 ring-white",
                i === 0 ? "bg-brand-primary" : "bg-neutral-300"
              )}
            />
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={entry.status} />
              <span className="text-[12px] text-neutral-500">{when(entry.at)}</span>
            </div>
            <p className="mt-0.5 text-[12.5px] text-neutral-700">
              {entry.byName}
              <span className="ml-1.5 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                {entry.byRole}
              </span>
            </p>
            {entry.note && (
              <p className="mt-1 text-[12.5px] italic text-neutral-600">{entry.note}</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
