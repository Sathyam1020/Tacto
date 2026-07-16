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
    const apply = () => {
      const dark = t === "dark" || (t === "auto" && mq.matches)
      document.documentElement.classList.toggle("dark", dark)
    }
    apply()
    if (t !== "auto") return
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [theme])
  return null
}
