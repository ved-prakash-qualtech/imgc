import { TableCell, TableRow } from "@/components/ui/table";

type DataTableEmptyRowProps = Readonly<{
  colSpan: number;
  message?: string;
}>;

export function DataTableEmptyRow({
  colSpan,
  message = "No results.",
}: DataTableEmptyRowProps) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className="h-24 text-center text-muted-foreground"
      >
        {message}
      </TableCell>
    </TableRow>
  );
}
