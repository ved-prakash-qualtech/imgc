import type { AxiosError } from "axios";

export class ApiError<T = unknown> extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: T
  ) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
    this.name = "ApiError";
  }
}

export function handleApiError<T = unknown>(error: AxiosError<T>): never {
  const status = error.response?.status;
  const data = error.response?.data;

  switch (status) {
    case 400:
      throw new ApiError<T>(status, "Bad Request: Invalid input", data);
    case 401:
      throw new ApiError<T>(status, "Unauthorized: Please login again", data);
    case 403:
      throw new ApiError<T>(status, "Forbidden: Access denied", data);
    case 404:
      throw new ApiError<T>(status, "Not Found: Resource not found", data);
    case 422:
      throw new ApiError<T>(status, "Validation Error", data);
    case 429:
      throw new ApiError<T>(status, "Too Many Requests: Please try again later", data);
    case 500:
      throw new ApiError<T>(status, "Internal Server Error", data);
    default:
      throw new ApiError<T>(status ?? 0, "An unexpected error occurred", data);
  }
}
