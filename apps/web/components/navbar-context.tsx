"use client"

import * as React from "react"

/**
 * Contextual navbar slot. The (app) layout owns the navbar; pages inject
 * their title and right-side actions (and can request a minimal navbar,
 * e.g. the editor's Back+Save). Handlers stay wired to the page's own state
 * because the injected node is rendered from the page's React tree.
 */

type NavbarState = {
  title: string | null
  /** Left-aligned content (replaces the trigger + title, e.g. a Back button). */
  leftActions: React.ReactNode | null
  actions: React.ReactNode | null
  /** Minimal chrome: hide the sidebar trigger + default page title. */
  minimal: boolean
  /** Full-bleed content: drop the chrome's padding + outer scroll so the page
   *  fills the surface itself (e.g. the form builder's fixed 3-pane layout). */
  bleed: boolean
}

type NavbarContextValue = NavbarState & {
  set: (state: Partial<NavbarState>) => void
  reset: () => void
}

const NavbarContext = React.createContext<NavbarContextValue | null>(null)

export function NavbarProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<NavbarState>({
    title: null,
    leftActions: null,
    actions: null,
    minimal: false,
    bleed: false,
  })

  const set = React.useCallback((partial: Partial<NavbarState>) => {
    setState((prev) => ({ ...prev, ...partial }))
  }, [])
  const reset = React.useCallback(
    () =>
      setState({
        title: null,
        leftActions: null,
        actions: null,
        minimal: false,
        bleed: false,
      }),
    []
  )

  const value = React.useMemo(
    () => ({ ...state, set, reset }),
    [state, set, reset]
  )

  return (
    <NavbarContext.Provider value={value}>{children}</NavbarContext.Provider>
  )
}

export function useNavbar(): NavbarContextValue {
  const ctx = React.useContext(NavbarContext)
  if (!ctx) throw new Error("useNavbar must be used within NavbarProvider")
  return ctx
}

/**
 * Declaratively set navbar contents for the lifetime of a page/component.
 * Pass a stable `deps` array (like useEffect). Clears on unmount.
 */
export function useSetNavbar(
  state: Partial<NavbarState>,
  deps: React.DependencyList
) {
  const { set, reset } = useNavbar()
  React.useEffect(() => {
    set(state)
    return () => reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
