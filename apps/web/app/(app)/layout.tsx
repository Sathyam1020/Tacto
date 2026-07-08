"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import {
  SidebarInset,
  SidebarProvider,
} from "@workspace/ui/components/sidebar"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { AppNavbar } from "@/components/app-navbar"
import { AppSidebar } from "@/components/app-sidebar"
import { authClient } from "@/lib/auth-client"

/**
 * Authenticated app shell: session guard + floating sidebar + floating
 * navbar. Pages inside (app)/ render on the paper canvas below the navbar.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()

  React.useEffect(() => {
    if (!isPending && !session) {
      router.replace("/sign-in")
    }
  }, [isPending, session, router])

  if (isPending || !session) {
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
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppNavbar />
        <main className="flex-1 px-6 py-8 md:px-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
