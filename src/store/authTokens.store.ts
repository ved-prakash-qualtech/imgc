"use client";

import { deleteCookie, getCookie, setCookie } from "cookies-next/client";
import { create } from "zustand";

import {
  AUTH_ACCESS_TOKEN_COOKIE_OPTIONS,
  AUTH_COOKIE_NAMES,
  AUTH_REFRESH_TOKEN_COOKIE_OPTIONS,
} from "@/constants/authCookies";

type AuthTokensStore = {
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearTokens: () => void;
};

function readAccessToken(): string | null {
  const value = getCookie(AUTH_COOKIE_NAMES.accessToken);
  return typeof value === "string" ? value : null;
}

function writeAccessToken(token: string): void {
  setCookie(
    AUTH_COOKIE_NAMES.accessToken,
    token,
    AUTH_ACCESS_TOKEN_COOKIE_OPTIONS
  );
}

function clearAccessTokenCookie(): void {
  deleteCookie(AUTH_COOKIE_NAMES.accessToken, { path: "/" });
}

function readRefreshToken(): string | null {
  const value = getCookie(AUTH_COOKIE_NAMES.refreshToken);
  return typeof value === "string" ? value : null;
}

function writeRefreshToken(token: string): void {
  setCookie(
    AUTH_COOKIE_NAMES.refreshToken,
    token,
    AUTH_REFRESH_TOKEN_COOKIE_OPTIONS
  );
}

function clearRefreshTokenCookie(): void {
  deleteCookie(AUTH_COOKIE_NAMES.refreshToken, { path: "/" });
}

export const useAuthTokensStore = create<AuthTokensStore>(() => ({
  setTokens: (accessToken, refreshToken) => {
    writeAccessToken(accessToken);
    writeRefreshToken(refreshToken);
  },
  clearTokens: () => {
    clearAccessTokenCookie();
    clearRefreshTokenCookie();
  },
}));

export function getAccessToken(): string | null {
  return readAccessToken();
}

export function getRefreshToken(): string | null {
  return readRefreshToken();
}

export function setTokens(accessToken: string, refreshToken: string): void {
  useAuthTokensStore.getState().setTokens(accessToken, refreshToken);
}

export function clearTokens(): void {
  useAuthTokensStore.getState().clearTokens();
}
