import { cn } from "@/lib/utils/twMergeUtils";

type SkeletonProps = Readonly<{
  className?: string;
}>;

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/30", className)}
      aria-hidden
    />
  );
}
