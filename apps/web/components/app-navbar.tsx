"use client"

import { usePathname } from "next/navigation"

import { Button } from "@workspace/ui/components/button"
import { Kbd } from "@workspace/ui/components/kbd"
import { Separator } from "@workspace/ui/components/separator"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { TouchRing } from "@workspace/ui/components/touch-ring"

/**
 * Floating navbar — a quiet hairline card at the top of the content canvas.
 * Left: sidebar trigger + current page. Right: the Capture action
 * (the app's one viridian verb; disabled until the extension ships).
 */

const PAGE_TITLES: Record<string, string> = {
  "/home": "Home",
  "/guides": "Guide",
  "/settings": "Settings",
}

export function AppNavbar() {
  const pathname = usePathname()
  const title =
    Object.entries(PAGE_TITLES).find(([href]) =>
      pathname.startsWith(href)
    )?.[1] ?? "Tacto"

  return (
    <header className="bg-card mx-4 mt-4 flex h-12 shrink-0 items-center gap-3 rounded-xl border px-3 md:mx-6">
      <Tooltip>
        <TooltipTrigger render={<SidebarTrigger />} />
        <TooltipContent side="bottom">
          Toggle sidebar <Kbd>⌘B</Kbd>
        </TooltipContent>
      </Tooltip>
      <Separator orientation="vertical" className="!h-4" />
      <span className="text-sm font-medium">{title}</span>

      <div className="flex-1" />

      <Tooltip>
        <TooltipTrigger
          render={
            <Button size="sm" disabled aria-label="Capture (coming soon)" />
          }
        >
          <TouchRing size="sm" tone="neutral" />
          Capture
        </TooltipTrigger>
        <TooltipContent side="bottom">Capture — coming soon</TooltipContent>
      </Tooltip>
    </header>
  )
}
