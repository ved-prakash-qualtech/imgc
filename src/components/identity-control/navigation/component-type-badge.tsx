import { cn } from "@/lib/utils/twMergeUtils";

const TONE: Record<string, string> = {
  Menu: "bg-primary/10 text-primary border-primary/20",
  Page: "bg-blue-500/10 text-blue-600 border-blue-200",
  Section: "bg-accent text-accent-foreground border-border",
  Widget: "bg-amber-500/10 text-amber-600 border-amber-200",
  Tab: "bg-green-500/10 text-green-600 border-green-200",
  Button: "bg-rose-500/10 text-rose-600 border-rose-200",
  Field: "bg-cyan-500/10 text-cyan-600 border-cyan-200",
  Action: "bg-amber-500/10 text-amber-600 border-amber-200",
};

export function ComponentTypeBadge({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        TONE[type] ?? "bg-muted text-foreground border-border",
        className
      )}
    >
      {type}
    </span>
  );
}
