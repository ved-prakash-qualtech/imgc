export const ROLES = ["admin", "user", "viewer"] as const;

export type Role = (typeof ROLES)[number];
