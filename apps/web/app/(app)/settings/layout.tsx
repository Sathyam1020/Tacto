"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { useSetNavbar } from "@/components/navbar-context"

/** Section title from the current settings sub-route (e.g. /settings/profile → "Profile"). */
function titleFor(pathname: string): string {
  const seg = pathname.replace(/^\/settings\/?/, "").split("/")[0]
  if (!seg) return "Settings"
  return seg.charAt(0).toUpperCase() + seg.slice(1)
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const title = titleFor(pathname)
  useSetNavbar({ title }, [title])
  return <>{children}</>
}
