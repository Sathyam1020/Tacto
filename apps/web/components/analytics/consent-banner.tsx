"use client"

import * as React from "react"
import Link from "next/link"

import { grantConsent, revokeConsent } from "@workspace/analytics/browser"

import { getConsent, setConsent } from "@/components/analytics/consent"

/**
 * Analytics notice for anonymous visitors on our marketing/app pages. Analytics
 * starts *enabled* (opt-out model); this banner just informs and offers an
 * opt-out. Rendered by <Analytics/> only when there's no session and the
 * visitor hasn't yet dismissed it or opted out.
 */
export function ConsentBanner() {
  const [decided, setDecided] = React.useState(true)

  React.useEffect(() => {
    setDecided(getConsent() !== null)
  }, [])

  if (decided) return null

  const acknowledge = () => {
    setConsent("granted")
    grantConsent()
    setDecided(true)
  }
  const optOut = () => {
    setConsent("denied")
    revokeConsent()
    setDecided(true)
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 pb-4"
    >
      <div className="flex w-full max-w-2xl flex-col items-start gap-3 rounded-2xl border border-[var(--l-hairline)] bg-white p-4 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.35)] sm:flex-row sm:items-center sm:gap-4 sm:p-4">
        <p className="flex-1 text-[13.5px] leading-relaxed text-[var(--l-ink-subtle)]">
          We use privacy-friendly analytics to understand how Tacto is used. You can opt out
          anytime. See our{" "}
          <Link href="/legal/cookies" className="font-medium text-cobalt underline underline-offset-2">
            cookie policy
          </Link>
          .
        </p>
        <div className="flex flex-none items-center gap-2">
          <button
            type="button"
            onClick={optOut}
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--l-ink-subtle)] transition-colors hover:bg-[var(--l-hover)]"
          >
            Opt out
          </button>
          <button
            type="button"
            onClick={acknowledge}
            className="rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-white transition-transform hover:scale-[1.02]"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
