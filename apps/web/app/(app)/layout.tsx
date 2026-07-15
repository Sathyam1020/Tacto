"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { Skeleton } from "@workspace/ui/components/skeleton"

import { AppShell } from "@/components/app-shell/app-shell"
import { LibraryViewProvider } from "@/components/app-shell/view-context"
import { CommandPalette } from "@/components/command-palette"
import { ExtensionOnboarding } from "@/components/extension-onboarding"
import { NavbarProvider, useNavbar } from "@/components/navbar-context"
import { authClient } from "@/lib/auth-client"
import { useExtension } from "@/lib/extension"

/**
 * Authenticated app shell: session guard + extension gate + the Linear
 * double-sidebar shell. The editor route (paths ending in /edit) is
 * chrome-free — just the injected Back/Save bar — for focused editing.
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
    <LibraryViewProvider>
      <NavbarProvider>
        <CommandPalette />
        {focusedEditor ? (
          <EditorChrome>{children}</EditorChrome>
        ) : (
          <AppShell>{children}</AppShell>
        )}
      </NavbarProvider>
    </LibraryViewProvider>
  )
}

/** Chrome-free editing surface — only the page's injected Back/Save bar. */
function EditorChrome({ children }: { children: React.ReactNode }) {
  const { leftActions, actions, bleed } = useNavbar()
  return (
    <div className="flex h-svh flex-col bg-background text-foreground">
      <header className="flex h-14 flex-none items-center justify-between gap-3 border-b px-5">
        <div className="flex min-w-0 items-center gap-2">{leftActions}</div>
        {actions}
      </header>
      {bleed ? (
        <div className="min-h-0 flex-1">{children}</div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-6">{children}</div>
      )}
    </div>
  )
}
