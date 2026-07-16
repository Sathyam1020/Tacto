"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Check, Monitor, Moon, Sun } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

import { SettingSection, SettingsPage } from "@/components/settings/setting-section"

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const

export default function AppearancePage() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const active = mounted ? (theme ?? "system") : undefined

  return (
    <SettingsPage>
      <SettingSection
        title="Theme"
        description="Choose how Tacto looks. System follows your device settings."
      >
        <div className="grid max-w-md grid-cols-3 gap-3">
          {THEMES.map(({ value, label, icon: Icon }) => {
            const selected = active === value
            return (
              <button
                key={value}
                onClick={() => setTheme(value)}
                aria-pressed={selected}
                className={cn(
                  "group relative flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors",
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-[var(--l-hairline)] hover:border-primary/40"
                )}
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg",
                    selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="text-[13px] font-medium">{label}</span>
                {selected && (
                  <span className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </SettingSection>
    </SettingsPage>
  )
}
