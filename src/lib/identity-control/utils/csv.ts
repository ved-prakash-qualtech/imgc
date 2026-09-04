export function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) =>
      r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportRowsCsv(
  name: string,
  headers: string[],
  rows: Record<string, string | number | undefined | null>[]
) {
  const matrix: (string | number)[][] = [
    headers,
    ...rows.map((row) => headers.map((h) => row[h] ?? "")),
  ];
  downloadCsv(name, matrix);
}
