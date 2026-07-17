"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

import { usePublicTheme } from "@/lib/public-theme"

/**
 * Light/dark toggle for the public surfaces (Help Center + Showcase). Lives in
 * the brand-colored header, so it inherits `--primary-foreground`. Renders both
 * icons and cross-fades to avoid a hydration mismatch flash.
 */
export function PublicThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = usePublicTheme()
  const isDark = theme === "dark"
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={cn(
        "relative flex size-9 items-center justify-center rounded-lg text-primary-foreground/80 transition-colors hover:bg-white/15 hover:text-primary-foreground",
        className
      )}
    >
      <Sun className={cn("absolute size-4 transition-all", isDark ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-90 opacity-0")} />
      <Moon className={cn("absolute size-4 transition-all", isDark ? "scale-50 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100")} />
    </button>
  )
}
