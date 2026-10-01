export type KpiTone =
  "primary" | "success" | "warning" | "destructive" | "info";

export type KpiDef = {
  label: string;
  value: string;
  trend: number;
  trendLabel?: string;
  tone: KpiTone;
  icon: string;
};

export type StatusVariant =
  "active" | "pending" | "approved" | "rejected" | "draft";

export type TableRow = Record<string, string | number | StatusVariant>;

export type TableColumn = {
  key: string;
  label: string;
  sortable?: boolean;
  type?: "text" | "status" | "date" | "action";
  className?: string;
};
