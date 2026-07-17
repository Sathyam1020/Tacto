"use client"

import * as React from "react"

/**
 * The marketing site is intentionally light. The app defaults to a `.dark`
 * class (next-themes) and re-applies it once after hydration, so a one-shot
 * removal loses the race. A short-lived MutationObserver strips `.dark`
 * whenever it reappears; the layout's pre-paint script covers the first frame
 * so there's no flash. `.dark` is restored on unmount for client-side nav back
 * into the app. (Same pattern as the public showcase/help surfaces.)
 */
export function LightLock() {
  React.useEffect(() => {
    const el = document.documentElement
    const wasDark = el.classList.contains("dark")
    el.classList.remove("dark")
    const obs = new MutationObserver(() => {
      if (el.classList.contains("dark")) el.classList.remove("dark")
    })
    obs.observe(el, { attributes: true, attributeFilter: ["class"] })
    return () => {
      obs.disconnect()
      if (wasDark) el.classList.add("dark")
    }
  }, [])
  return null
}
