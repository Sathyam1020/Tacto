"use client"

import * as React from "react"

/**
 * Enforces the embed's `theme` after hydration (the layout's pre-paint script
 * handles first paint). `auto` follows the host's color scheme and reacts to
 * changes; `light`/`dark` pin it. Renders nothing.
 */
export function EmbedTheme({ theme }: { theme?: string }) {
  React.useEffect(() => {
    const t = theme === "light" || theme === "dark" ? theme : "auto"
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const el = document.documentElement
    const wantsDark = () => t === "dark" || (t === "auto" && mq.matches)
    const apply = () => el.classList.toggle("dark", wantsDark())
    apply()
    // next-themes re-applies the app's default `.dark` once after hydration,
    // which would override `?theme=`. Hold our choice: re-apply whenever the
    // class drifts from what the embed asked for.
    const obs = new MutationObserver(() => {
      if (el.classList.contains("dark") !== wantsDark()) apply()
    })
    obs.observe(el, { attributes: true, attributeFilter: ["class"] })
    if (t === "auto") mq.addEventListener("change", apply)
    return () => {
      obs.disconnect()
      if (t === "auto") mq.removeEventListener("change", apply)
    }
  }, [theme])
  return null
}
