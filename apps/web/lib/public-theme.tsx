"use client"

import * as React from "react"

/**
 * Independent light/dark theme for the PUBLIC surfaces (Help Center + Showcase).
 * These pages render under the app's next-themes provider, which defaults to a
 * `.dark` class — but a public visitor's theme choice should be their own, not
 * the workspace owner's app preference. So we own the `.dark` class here:
 *  - default LIGHT (the public look), persisted under our own storage key;
 *  - a MutationObserver holds our choice against next-themes re-applying the
 *    app default after hydration;
 *  - on unmount (owner navigating back into the app) we restore next-themes'
 *    own preference so the app isn't left on the public theme.
 *
 * A pre-paint script (rendered by each public layout) applies the saved choice
 * before first paint, so there's no flash. Toggle via `usePublicTheme()`.
 */

const KEY = "tacto-public-theme"
/** next-themes' default storageKey (the app's own preference). */
const APP_KEY = "theme"

export type PublicTheme = "light" | "dark"

/** Inline script string — read the saved public theme (default light) and set
 *  the `.dark` class before paint. Rendered by the public layouts. */
export const PUBLIC_THEME_PREPAINT =
  "try{var t=localStorage.getItem('" +
  KEY +
  "');var c=document.documentElement.classList;t==='dark'?c.add('dark'):c.remove('dark');}catch(e){}"

type Ctx = { theme: PublicTheme; setTheme: (t: PublicTheme) => void; toggle: () => void }
const PublicThemeContext = React.createContext<Ctx>({
  theme: "light",
  setTheme: () => {},
  toggle: () => {},
})

export function usePublicTheme(): Ctx {
  return React.useContext(PublicThemeContext)
}

function applyClass(t: PublicTheme) {
  const c = document.documentElement.classList
  if (t === "dark") c.add("dark")
  else c.remove("dark")
}

export function PublicThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<PublicTheme>("light")
  const themeRef = React.useRef<PublicTheme>("light")

  const setTheme = React.useCallback((t: PublicTheme) => {
    themeRef.current = t
    setThemeState(t)
    try {
      localStorage.setItem(KEY, t)
    } catch {
      /* private mode */
    }
    applyClass(t)
  }, [])

  const toggle = React.useCallback(() => {
    setTheme(themeRef.current === "dark" ? "light" : "dark")
  }, [setTheme])

  React.useEffect(() => {
    let initial: PublicTheme = "light"
    try {
      initial = localStorage.getItem(KEY) === "dark" ? "dark" : "light"
    } catch {
      /* private mode */
    }
    themeRef.current = initial
    setThemeState(initial)
    applyClass(initial)

    // Hold our choice: next-themes re-applies the app default once after
    // hydration; re-assert whenever the class drifts from our preference.
    const el = document.documentElement
    const obs = new MutationObserver(() => {
      const isDark = el.classList.contains("dark")
      if (themeRef.current === "dark" && !isDark) el.classList.add("dark")
      else if (themeRef.current === "light" && isDark) el.classList.remove("dark")
    })
    obs.observe(el, { attributes: true, attributeFilter: ["class"] })

    return () => {
      obs.disconnect()
      // Restore the app's own theme for client-side navigation back into it.
      try {
        applyClass(localStorage.getItem(APP_KEY) === "light" ? "light" : "dark")
      } catch {
        applyClass("dark")
      }
    }
  }, [])

  const value = React.useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle])
  return <PublicThemeContext.Provider value={value}>{children}</PublicThemeContext.Provider>
}
