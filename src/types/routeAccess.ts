import type { Role } from "@/types/roles";

export type RouteAccessLevel = "public" | "auth";

export type RouteAccessDefinition = {
  path: string;
  access: RouteAccessLevel;
  roles?: readonly Role[];
};

export type MatchedRouteAccess = RouteAccessDefinition & {
  key: string;
};
