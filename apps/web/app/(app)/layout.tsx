"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import {
  SidebarInset,
  SidebarProvider,
} from "@workspace/ui/components/sidebar"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { AppNavbar } from "@/components/app-navbar"
import { AppSidebar } from "@/components/app-sidebar"
import { ExtensionOnboarding } from "@/components/extension-onboarding"
import { NavbarProvider } from "@/components/navbar-context"
import { authClient } from "@/lib/auth-client"
import { useExtension } from "@/lib/extension"

/**
 * Authenticated app shell: session guard + floating sidebar + floating
 * navbar. The editor route (paths ending in /edit) is chrome-free — sidebar
 * hidden — for a focused editing surface.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, isPending } = authClient.useSession()
  const { state: extensionState } = useExtension()
  const focusedEditor = pathname.endsWith("/edit")

  React.useEffect(() => {
    if (!isPending && !session) {
      router.replace("/sign-in")
    }
  }, [isPending, session, router])

  // Gate the app on the extension: capturing is the product.
  if (session && extensionState !== "unknown" && extensionState !== "connected") {
    return <ExtensionOnboarding state={extensionState} />
  }

  if (isPending || !session || extensionState === "unknown") {
    return (
      <div className="flex min-h-svh gap-4 p-4">
        <Skeleton className="hidden w-60 rounded-xl md:block" />
        <div className="flex-1">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="mt-6 h-8 w-64" />
          <Skeleton className="mt-4 h-4 w-full max-w-lg" />
        </div>
      </div>
    )
  }

  return (
    <NavbarProvider>
      <SidebarProvider>
        {!focusedEditor && <AppSidebar />}
        <SidebarInset>
          <AppNavbar />
          <main className="flex-1 px-6 py-8 md:px-8">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </NavbarProvider>
  )
}
