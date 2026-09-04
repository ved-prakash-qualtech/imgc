"use client";

import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";

/**
 * Zustand store pattern (frontend-project-standards.md §5):
 * state + actions + selectors, devtools for debugging, persist with
 * partialize for the fields worth keeping. Client/UI state only —
 * server data stays in the SSR layer; never persist tokens or PII.
 */
interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiState>()(
  devtools(
    persist(
      (set) => ({
        sidebarCollapsed: false,
        toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      }),
      {
        name: "qcp-ui",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
      },
    ),
  ),
);

/** Selector hooks — components subscribe to slices, not the whole store. */
export const useSidebarCollapsed = () => useUiStore((state) => state.sidebarCollapsed);
