export const AUTH_COOKIE_NAMES = {
  accessToken: "accessToken",
  refreshToken: "refreshToken",
} as const;

/** Cookie max-age: 1 day (seconds). */
export const AUTH_COOKIE_MAX_AGE_ONE_DAY = 60 * 60 * 24;

/** Cookie max-age: 7 days (seconds). */
export const AUTH_COOKIE_MAX_AGE_SEVEN_DAYS = 60 * 60 * 24 * 7;

export const AUTH_ACCESS_TOKEN_COOKIE_OPTIONS = {
  secure: true,
  sameSite: "strict" as const,
  maxAge: AUTH_COOKIE_MAX_AGE_ONE_DAY,
} as const;

export const AUTH_REFRESH_TOKEN_COOKIE_OPTIONS = {
  secure: true,
  sameSite: "strict" as const,
  maxAge: AUTH_COOKIE_MAX_AGE_SEVEN_DAYS,
} as const;
