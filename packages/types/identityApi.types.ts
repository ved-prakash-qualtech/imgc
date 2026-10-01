/**
 * Shared API Type Definitions
 *
 * Following the KYC Web App architecture pattern.
 * These types are used across all API layers.
 */

import type { AxiosRequestConfig } from "axios";

/**
 * Standard API response structure
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  errorMessage?: string;
  statusCode?: number;
  timestamp?: string;
}

/**
 * Standard paginated response
 */
export interface PaginatedData<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

/**
 * Standard error response
 */
export interface ApiError {
  message: string;
  statusCode?: number;
  status?: number;
  code?: string;
  details?: Record<string, unknown>;
  data?: unknown;
  response?: {
    data?: unknown;
    status?: number;
  };
  timestamp?: string;
}

/**
 * Request configuration
 */
export type RequestConfig = Omit<
  AxiosRequestConfig,
  "method" | "url" | "data"
> & {
  skipAuth?: boolean;
};

/**
 * Backend API envelope
 *
 * The backend wraps all responses in this structure.
 * Use with extractApiResponse() to unwrap the data field.
 */
export interface BackendApiResponse<T = unknown> {
  status: "SUCCESS" | "ERROR" | string;
  statusCode: number;
  message: string;
  data?: T;
  timestamp?: string;
}

/**
 * Minimal success response (no data payload)
 */
export interface SuccessResponse {
  success: boolean;
  message: string;
  data?: unknown;
}

/**
 * Minimal error response
 */
export interface ErrorResponse {
  success: boolean;
  message: string;
  error?: string;
  statusCode?: number;
  timestamp?: string;
}

/**
 * List parameters
 */
export interface ListParams {
  page?: number;
  size?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  [key: string]: unknown;
}
