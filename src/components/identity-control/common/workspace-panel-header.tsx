"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function WorkspacePanelHeader({
  title,
  count,
  actions,
  className,
}: {
  title: React.ReactNode;
  count?: number | string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-10 flex-wrap items-center gap-2 border-b border-border bg-secondary/20 px-3 py-1.5",
        className
      )}
    >
      <h2 className="text-xs font-semibold text-foreground">{title}</h2>
      {count !== undefined && (
        <Badge variant="outline" className="text-[9px]">
          {count}
        </Badge>
      )}
      {actions && (
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          {actions}
        </div>
      )}
    </div>
  );
}
