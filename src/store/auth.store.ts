"use client";

import { create } from "zustand";

import { clearTokens } from "@/store/authTokens.store";
import type { Role } from "@/types/roles";

export {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "@/store/authTokens.store";

export type AuthUser = { id: string; email: string; roles?: Role[] };

type AuthStore = {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  signOut: () => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  signOut: () => {
    clearTokens();
    set({ user: null });
  },
}));
