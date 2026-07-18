"use client"

import * as React from "react"
import { usePathname, useSearchParams } from "next/navigation"

import {
  capturePageview,
  grantConsent,
  group,
  identify,
  initBrowserAnalytics,
  reset,
} from "@workspace/analytics/browser"

import { ConsentBanner } from "@/components/analytics/consent-banner"
import { authClient } from "@/lib/auth-client"

/**
 * The single PostHog mount point for the app. Nothing else initializes
 * analytics. Gated by pathname so **public/embedded surfaces never load
 * PostHog** — those are our customers' end-users, tracked by the first-party
 * analytics (phase 12), not our product analytics.
 */
const PUBLIC_VIEWER_PREFIXES = ["/g/", "/f/", "/help/", "/showcase/", "/embed/"]
function isPublicViewer(path: string): boolean {
  return path === "/g" || path === "/help" || PUBLIC_VIEWER_PREFIXES.some((p) => path.startsWith(p))
}

const CONFIG = {
  key: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,
  apiHost: "/ingest",
  uiHost: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.posthog.com",
  environment: process.env.NODE_ENV,
  appVersion: process.env.NEXT_PUBLIC_APP_VERSION,
  buildSha: process.env.NEXT_PUBLIC_BUILD_SHA,
  // Anonymous visitors on our own marketing/app surfaces are captured by
  // default (top-of-funnel product analytics). The banner is a notice with an
  // opt-out — not an opt-in gate. A visitor who opts out is persisted by
  // PostHog and stays opted out on return.
  optOutByDefault: false,
}

export function Analytics() {
  const pathname = usePathname() ?? ""
  const allowed = !isPublicViewer(pathname)

  React.useEffect(() => {
    if (allowed) initBrowserAnalytics(CONFIG)
  }, [allowed])

  if (!allowed) return null
  return (
    <>
      <React.Suspense fallback={null}>
        <PageviewTracker />
      </React.Suspense>
      <Identity />
    </>
  )
}

/** Manual pageviews — App Router client navigation doesn't emit them. */
function PageviewTracker() {
  const pathname = usePathname()
  const search = useSearchParams()
  React.useEffect(() => {
    capturePageview()
  }, [pathname, search])
  return null
}

/** Ties the analytics person + workspace group to the better-auth session, and
 *  resets on sign-out. Capturing is on by default (opt-out model); anonymous
 *  visitors get a dismissible notice with an opt-out until they act on it. */
function Identity() {
  const { data: session } = authClient.useSession()
  const { data: org } = authClient.useActiveOrganization()
  const userId = session?.user?.id
  const wasAuthed = React.useRef(false)

  React.useEffect(() => {
    const user = session?.user
    if (user) {
      grantConsent() // authenticated → covered by the ToS
      identify(user.id, { email: user.email, name: user.name ?? undefined })
      wasAuthed.current = true
    } else if (wasAuthed.current) {
      reset() // signed out
      wasAuthed.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  React.useEffect(() => {
    if (org) group(org.id, { name: org.name, slug: org.slug ?? undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id])

  return userId ? null : <ConsentBanner />
}
