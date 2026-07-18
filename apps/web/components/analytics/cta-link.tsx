"use client"

import Link from "next/link"

import { capture } from "@workspace/analytics/browser"

/**
 * A next/link that emits a typed `cta_clicked` event on click — the client's
 * job is intent (clicks/navigation); outcomes (signup, publish) fire server-
 * side. Drop-in replacement for <Link> on marketing CTAs.
 */
export function CtaLink({
  location,
  label,
  onClick,
  ...props
}: React.ComponentProps<typeof Link> & { location: string; label?: string }) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        capture("cta_clicked", { location, ...(label ? { label } : {}) })
        onClick?.(e)
      }}
    />
  )
}
