"use client"

import * as React from "react"

const KEY = "tacto_anon_id"

/**
 * Read (or lazily mint) the stable per-browser anonymous id. Returns null when
 * storage is unavailable (private mode) — callers treat that as "anonymous".
 * Safe to call outside React (e.g. from the analytics beacon).
 */
export function readAnonId(): string | null {
  try {
    let v = localStorage.getItem(KEY)
    if (!v) {
      v = crypto.randomUUID()
      localStorage.setItem(KEY, v)
    }
    return v
  } catch {
    return null
  }
}

/** Stable per-browser id for anonymous reactions/comments/analytics. "" until
 *  mounted (SSR-safe); shared across the public reader. */
export function useAnonId(): string {
  const [id, setId] = React.useState("")
  React.useEffect(() => {
    const v = readAnonId()
    if (v) setId(v)
  }, [])
  return id
}
