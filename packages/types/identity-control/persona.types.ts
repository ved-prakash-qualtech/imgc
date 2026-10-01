export type PersonaId =
  | "rbac-owner-maker"
  | "rbac-owner-author"
  | "platform-tenant-admin-maker"
  | "platform-tenant-admin-author"
  | "app-owner-maker"
  | "app-owner-author"
  | "tenant-admin-maker"
  | "tenant-admin-author";

export type PersonaGroup =
  | "RBAC Application"
  | "Platform Tenant Admin"
  | "Application Tenant Admin"
  | "Client Tenant Admin";

export type PersonaDef = {
  id: PersonaId;
  label: string;
  variant: "Maker" | "Author";
  group: PersonaGroup;
};

export type PersonaDashboard = {
  kpis: import("./common.types").KpiDef[];
  columns: import("./common.types").TableColumn[];
  rows: import("./common.types").TableRow[];
};
