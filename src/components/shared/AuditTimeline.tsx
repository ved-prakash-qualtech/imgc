"use client";

import { Activity, FilePlus, FileMinus, Edit3, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAuditLog,
  type AuditEntity,
  type AuditEntry,
} from "@/lib/identity-control/stores/audit-log-store";

function iconFor(a: AuditEntry["action"]) {
  switch (a) {
    case "create":
      return FilePlus;
    case "delete":
      return Trash2;
    case "update":
      return Edit3;
    case "cleanup":
      return FileMinus;
    default:
      return Activity;
  }
}

function toneFor(a: AuditEntry["action"]) {
  switch (a) {
    case "create":
      return "bg-success/10 text-success border-success/30";
    case "delete":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "update":
      return "bg-info/10 text-info border-info/30";
    default:
      return "bg-muted text-foreground border-border";
  }
}

function fmt(at: string) {
  try {
    const d = new Date(at);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleString();
  } catch {
    return at;
  }
}

export function AuditTimeline({
  entities,
  limit = 25,
  search,
}: {
  entities: AuditEntity[];
  limit?: number;
  search?: string;
}) {
  const all = useAuditLog();
  const q = (search ?? "").trim().toLowerCase();
  const filtered = all
    .filter((e) => entities.includes(e.entity))
    .filter((e) => {
      if (!q) return true;
      const hay =
        `${e.entityName ?? ""} ${e.entityId} ${e.action} ${e.actor} ${e.detail ?? ""}`.toLowerCase();
      return hay.includes(q);
    })
    .slice(0, limit);

  if (filtered.length === 0) {
    return (
      <div className="py-6 text-center text-[11px] text-muted-foreground">
        No audit entries yet.
      </div>
    );
  }

  return (
    <ol className="relative ml-2 space-y-2 border-l border-border pl-4">
      {filtered.map((e) => {
        const Icon = iconFor(e.action);
        const tone = toneFor(e.action);
        return (
          <li key={e.id} className="relative">
            <span
              className={cn(
                "absolute -left-[26px] flex h-5 w-5 items-center justify-center rounded-full border bg-card",
                tone
              )}
            >
              <Icon className="h-2.5 w-2.5" />
            </span>
            <div className="rounded-md border border-border bg-card p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold capitalize text-foreground">
                    {e.action} · {e.entityName ?? e.entityId}
                  </div>
                  {e.detail && (
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      {e.detail}
                    </p>
                  )}
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                    tone
                  )}
                >
                  {e.entity}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{e.actor}</span>
                <span>{fmt(e.at)}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
