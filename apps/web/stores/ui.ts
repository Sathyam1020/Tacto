import { create } from "zustand"

/**
 * Global UI state (zustand). Rules of the road:
 *  - UI state only (panels, modes, transient flags).
 *  - Server data belongs in React Query; session state in useSession.
 */
type UiState = {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
