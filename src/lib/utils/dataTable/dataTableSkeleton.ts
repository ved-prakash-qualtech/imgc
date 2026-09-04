import type {
  DataTableSkeletonCellConfig,
  DataTableSkeletonVariant,
} from "@/types/dataTable";
import { cn } from "@/lib/utils/twMergeUtils";

function skeletonVariantClass(variant: DataTableSkeletonVariant): string {
  switch (variant) {
    case "badge":
      return "h-5 w-16 rounded-full";
    case "circle":
      return "size-8 rounded-full";
    case "full":
      return "h-4 w-full";
    case "text":
    default:
      return "h-4 w-3/4 max-w-[12rem]";
  }
}

export function resolveSkeletonClassName(
  config?: DataTableSkeletonCellConfig
): string {
  const variant = config?.variant ?? "text";
  return cn(skeletonVariantClass(variant), config?.className);
}

export function resolveLoadingRowCount(
  loadingConfig: { rowCount?: number } | undefined,
  pageSize: number
): number {
  const rowCount = loadingConfig?.rowCount ?? pageSize;
  return Math.max(1, rowCount);
}
