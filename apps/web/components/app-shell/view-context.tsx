"use client"

import * as React from "react"

import type { LibraryView } from "@/lib/library"

/**
 * Shared library navigation state, owned by the app shell so the folders panel
 * and the library grid stay in sync across route changes (the (app) layout
 * persists, so this survives navigating into a guide and back).
 */
type ViewContextValue = {
  view: LibraryView
  setView: (v: LibraryView) => void
  query: string
  setQuery: (q: string) => void
  /** Mobile: the folders drawer open state. */
  mobileOpen: boolean
  setMobileOpen: (v: boolean) => void
}

const ViewContext = React.createContext<ViewContextValue | null>(null)

const STORAGE_KEY = "tacto:library-view"

export function LibraryViewProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [view, setViewState] = React.useState<LibraryView>({ type: "all" })
  const [query, setQuery] = React.useState("")
  const [mobileOpen, setMobileOpen] = React.useState(false)

  // Restore the last-open view after a refresh (persisted below). Done post
  // mount so server + client first render agree (no hydration mismatch).
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as LibraryView
      if (parsed && typeof parsed.type === "string") setViewState(parsed)
    } catch {
      // ignore malformed storage
    }
  }, [])

  const setView = React.useCallback((v: LibraryView) => {
    setViewState(v)
    setMobileOpen(false)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
    } catch {
      // ignore storage failures (private mode, etc.)
    }
  }, [])

  const value = React.useMemo(
    () => ({ view, setView, query, setQuery, mobileOpen, setMobileOpen }),
    [view, setView, query, mobileOpen]
  )

  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>
}

export function useLibraryViewState(): ViewContextValue {
  const ctx = React.useContext(ViewContext)
  if (!ctx)
    throw new Error("useLibraryViewState must be used within LibraryViewProvider")
  return ctx
}
