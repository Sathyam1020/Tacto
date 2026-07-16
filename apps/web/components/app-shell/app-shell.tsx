"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

import { CaptureButton } from "@/components/capture-button"
import { FoldersPanel } from "@/components/app-shell/folders-panel"
import { FormsPanel } from "@/components/app-shell/forms-panel"
import { Rail } from "@/components/app-shell/rail"
import { SettingsPanel } from "@/components/app-shell/settings-panel"

// Code-split: the Help Center panel pulls in the full lucide icon library (for
// the collection icon picker), so it only loads on /help-center — never in the
// shared shell chunk on every authed page.
const HelpCenterPanel = dynamic(
  () =>
    import("@/components/app-shell/help-center-panel").then(
      (m) => m.HelpCenterPanel
    ),
  {
    loading: () => (
      <div className="mt-1.5 mb-1.5 w-64 flex-none rounded-l-3xl border-t border-r border-b border-l border-[var(--l-hairline)] bg-gradient-to-b from-[var(--l-panel-a)] to-[var(--l-panel-b)]" />
    ),
  }
)
import { useLibraryViewState } from "@/components/app-shell/view-context"
import { useNavbar } from "@/components/navbar-context"

/**
 * The Linear double-sidebar shell: a rail (deepest surface) + folders panel +
 * content card, floating on the canvas as a 3-step gradient ladder. The top bar
 * renders whatever the active page injects via the navbar slot (guide viewer,
 * settings, and the library each set their own); the default is the page title
 * + Capture button. On mobile the rail + panel slide in as a drawer.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { view, mobileOpen, setMobileOpen } = useLibraryViewState()
  const { title, leftActions, actions } = useNavbar()
  const pathname = usePathname()
  // The Forms section (its library + detail/builder) shows the Forms sidebar;
  // everything else shows the Guides folders panel.
  const inForms = pathname?.startsWith("/forms") ?? false
  const inHelp = pathname?.startsWith("/help-center") ?? false
  const inSettings = pathname?.startsWith("/settings") ?? false
  // A capture started while viewing a folder lands in that folder.
  const captureFolderId = view.type === "folder" ? view.id : null

  return (
    <div className="relative flex h-svh overflow-hidden bg-[var(--l-canvas)] text-foreground">
      {/* mobile backdrop */}
      {mobileOpen && (
        <button
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      )}

      {/* Rail + folders panel (drawer on mobile) */}
      <div
        className={cn(
          "z-50 flex h-svh bg-gradient-to-b from-[var(--l-rail-a)] to-[var(--l-rail-b)]",
          "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:transition-transform max-md:duration-200",
          mobileOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full"
        )}
      >
        <Rail />
        {inSettings ? (
          <SettingsPanel />
        ) : inHelp ? (
          <HelpCenterPanel />
        ) : inForms ? (
          <FormsPanel />
        ) : (
          <FoldersPanel />
        )}
      </div>

      {/* Content card */}
      <main className="mt-1.5 mr-1.5 mb-1.5 flex min-w-0 flex-1 flex-col overflow-hidden rounded-r-3xl border-t border-r border-b border-[var(--l-hairline)] bg-gradient-to-b from-[var(--l-content-a)] to-[var(--l-content-b)]">
        <header className="flex h-14 flex-none items-center justify-between gap-3 border-b border-[var(--l-hairline)] px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
              className="-ml-1 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
            >
              <Menu className="size-4" />
            </button>
            {leftActions ?? (
              <h1 className="truncate text-[15px] font-semibold">
                {title ?? "Tacto"}
              </h1>
            )}
          </div>
          {actions ?? <CaptureButton folderId={captureFolderId} />}
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {children}
        </div>
      </main>
    </div>
  )
}
