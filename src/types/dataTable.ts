export type DataTableSkeletonVariant = "text" | "badge" | "circle" | "full";

export type DataTableSkeletonCellConfig = {
  variant?: DataTableSkeletonVariant;
  className?: string;
};

export type DataTableLoadingConfig = {
  /** Skeleton rows to render while loading. Defaults to current page size. */
  rowCount?: number;
};
