/**
 * QCP backend response envelope (locked contract — docs/standards/api-standards.md §3).
 * Every QCP backend endpoint returns this shape for success and error alike.
 */
export interface APIResponse<T> {
  status: "SUCCESS" | "ERROR";
  statusCode: number;
  message?: string;
  data?: T;
  errorCode?: string;
  errorMessage?: string;
  path?: string;
  errors?: Array<{ field: string; errorCode: string; errorMessage: string }>;
  timestamp: string;
}

/**
 * Standardized server-action result (frontend-project-standards.md §1).
 * Every server action returns this — client components never see raw errors.
 */
export type ServerActionResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };
