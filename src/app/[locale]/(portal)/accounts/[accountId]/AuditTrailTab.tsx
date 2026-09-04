"use client";

import { useMemo, useState } from "react";

import { Panel } from "@/components/portal/Panel";
import { cn } from "@/lib/utils/twMergeUtils";
import type { AuditEvent, AuditType } from "@/server/mock/types";

const GROUPS: ReadonlyArray<{ label: string; types: AuditType[] | null }> = [
  { label: "Everything", types: null },
  {
    label: "Documents",
    types: [
      "DOC_UPLOADED",
      "DOC_STATUS_CHANGED",
      "DOC_REQUIREMENT_ADDED",
      "REINSTATE_REQUESTED",
      "REINSTATE_DECIDED",
      "RETENTION_PURGED",
    ],
  },
  { label: "Remarks", types: ["REMARK_ADDED"] },
  { label: "PAS", types: ["PAS_VALUE_UPDATED"] },
  {
    label: "Processing",
    types: ["BUCKET_SHIFTED", "CLAIM_SUBMITTED", "CLAIM_STATUS_CHANGED"],
  },
];

const TYPE_TONE = new Map<AuditType, string>([
  ["DOC_UPLOADED", "bg-info/12 text-info"],
  ["DOC_STATUS_CHANGED", "bg-brand-muted text-brand-dark"],
  ["DOC_REQUIREMENT_ADDED", "bg-brand-muted text-brand-dark"],
  ["REMARK_ADDED", "bg-neutral-100 text-neutral-600"],
  ["PAS_VALUE_UPDATED", "bg-success/15 text-success-700"],
  ["BUCKET_SHIFTED", "bg-warning/15 text-warning"],
  ["CLAIM_SUBMITTED", "bg-info/12 text-info"],
  ["CLAIM_STATUS_CHANGED", "bg-warning/15 text-warning"],
  ["REINSTATE_REQUESTED", "bg-warning/15 text-warning"],
  ["REINSTATE_DECIDED", "bg-success/15 text-success-700"],
  ["RETENTION_PURGED", "bg-destructive/12 text-destructive"],
]);

/** BRD: a trail of every document, remark and decision on the account. Append-only. */
export function AuditTrailTab({ events }: Readonly<{ events: AuditEvent[] }>) {
  const [group, setGroup] = useState(0);

  const rows = useMemo(() => {
    const types = GROUPS[group]?.types;
    if (!types) return events;
    const set = new Set(types);
    return events.filter((e) => set.has(e.type));
  }, [events, group]);

  return (
    <Panel
      title="Audit trail"
      description="Every upload, decision, remark and PAS write on this account."
      actions={
        <div
          className="flex flex-wrap items-center gap-0.5 rounded-lg border border-neutral-200 p-0.5"
          role="group"
          aria-label="Filter the audit trail"
        >
          {GROUPS.map((g, i) => (
            <button
              key={g.label}
              type="button"
              onClick={() => setGroup(i)}
              aria-pressed={group === i}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                group === i
                  ? "bg-brand-primary text-white"
                  : "text-neutral-600 hover:bg-neutral-50"
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      }
    >
      {rows.length === 0 ? (
        <p className="px-5 py-12 text-center text-[13px] text-neutral-500">
          Nothing recorded under that filter.
        </p>
      ) : (
        <ol className="relative px-5 py-4">
          {rows.map((e, i) => (
            <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
              {/* connector */}
              {i < rows.length - 1 && (
                <span
                  aria-hidden
                  className="absolute left-[5px] top-4 h-full w-px bg-neutral-200"
                />
              )}
              <span
                aria-hidden
                className="relative mt-1.5 size-2.5 shrink-0 rounded-full border-2 border-white bg-brand-primary ring-1 ring-neutral-200"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      TYPE_TONE.get(e.type) ?? "bg-neutral-100 text-neutral-600"
                    )}
                  >
                    {e.type.replaceAll("_", " ")}
                  </span>
                  <span className="text-[11.5px] text-neutral-400">
                    {new Date(e.at).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="mt-1 text-[13px] leading-snug text-neutral-800">
                  {e.summary}
                </p>
                <p className="mt-0.5 text-[11.5px] text-neutral-400">
                  {e.actorName} · {e.actorRole}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
