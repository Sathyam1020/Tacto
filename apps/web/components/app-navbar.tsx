"use client"

import { usePathname } from "next/navigation"

import { Kbd } from "@workspace/ui/components/kbd"
import { Separator } from "@workspace/ui/components/separator"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

import { CaptureButton } from "@/components/capture-button"
import { useNavbar } from "@/components/navbar-context"

/**
 * Floating navbar — a quiet hairline card at the top of the content canvas.
 * Contents are contextual: pages inject a title + right-side actions via the
 * navbar slot. Default (no injection) = page title + Capture button.
 */

const PAGE_TITLES: Record<string, string> = {
  "/home": "Home",
  "/settings": "Settings",
}

export function AppNavbar() {
  const pathname = usePathname()
  const { title, leftActions, actions, minimal } = useNavbar()

  const pageTitle =
    title ??
    Object.entries(PAGE_TITLES).find(([href]) =>
      pathname.startsWith(href)
    )?.[1] ??
    "Tacto"

  return (
    <div className="bg-background/70 sticky top-0 z-30 px-4 pt-4 pb-2 backdrop-blur md:px-6">
      <header className="bg-card flex h-12 shrink-0 items-center gap-3 rounded-xl border px-3">
        {leftActions ?? (
        <>
          {!minimal && (
            <>
              <Tooltip>
                <TooltipTrigger render={<SidebarTrigger />} />
                <TooltipContent side="bottom">
                  Toggle sidebar <Kbd>⌘B</Kbd>
                </TooltipContent>
              </Tooltip>
              <Separator orientation="vertical" className="!h-4" />
            </>
          )}
          <span className="truncate text-sm font-medium">{pageTitle}</span>
        </>
      )}

        <div className="flex-1" />

        {actions ?? <CaptureButton />}
      </header>
    </div>
  )
}
