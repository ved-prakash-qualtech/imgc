import Image from "next/image";

type SortIconProps = Readonly<{
  className?: string;
}>;

/**
 * Neutral/unsorted sort indicator (up + down triangles), shared by
 * `DataTableColumnHeader` and available for any other sortable-column UI
 * that wants the same icon — just import and drop it in.
 */
export function SortIcon({ className }: SortIconProps) {
  return (
    <Image
      src="/assets/icons/sorting.svg"
      alt=""
      width={13}
      height={14}
      aria-hidden
      className={className}
    />
  );
}
