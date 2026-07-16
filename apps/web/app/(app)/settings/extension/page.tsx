"use client"

import * as React from "react"
import { Loader2, Puzzle, RefreshCw } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { SettingSection, SettingsPage } from "@/components/settings/setting-section"
import { SettingRow, SettingRows } from "@/components/settings/setting-row"
import { useExtension } from "@/lib/extension"
import { parseUserAgent } from "@/lib/settings"

const STATUS: Record<string, { label: string; dot: string; tone: string }> = {
  connected: { label: "Connected", dot: "bg-[var(--l-success)]", tone: "text-[var(--l-success)]" },
  "not-connected": { label: "Installed · not connected", dot: "bg-amber", tone: "text-amber-ink" },
  "not-installed": { label: "Not installed", dot: "bg-muted-foreground", tone: "text-muted-foreground" },
}

export default function ExtensionPage() {
  const { state, workspaceName } = useExtension()
  const [browser, setBrowser] = React.useState<string | null>(null)
  React.useEffect(() => {
    setBrowser(parseUserAgent(navigator.userAgent).browser)
  }, [])

  const detecting = state === "unknown"
  const status = STATUS[state] ?? STATUS["not-installed"]!

  return (
    <SettingsPage>
      <SettingSection
        title="Chrome extension"
        description="Tacto captures workflows through its browser extension."
        actions={
          state === "connected" || state === "not-connected" ? (
            <Button size="sm" variant="outline" onClick={() => (window.location.href = "/extension/connect")}>
              <Puzzle className="size-4" />
              {state === "connected" ? "Reconnect" : "Connect"}
            </Button>
          ) : state === "not-installed" ? (
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          ) : undefined
        }
      >
        <div className="rounded-xl border border-[var(--l-hairline)]">
          <div className="flex items-center gap-3 border-b border-[var(--l-hairline)] px-4 py-3.5">
            <span className="flex size-9 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Puzzle className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Tacto for Chrome</p>
              <p className="flex items-center gap-1.5 text-[12px]">
                {detecting ? (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> Checking…
                  </span>
                ) : (
                  <>
                    <span className={cn("size-1.5 rounded-full", status.dot)} />
                    <span className={status.tone}>{status.label}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <SettingRows className="px-4">
            <SettingRow label="Browser">
              <span className="text-sm text-muted-foreground">{browser ?? "—"}</span>
            </SettingRow>
            {state === "connected" && (
              <SettingRow label="Linked workspace">
                <span className="text-sm text-muted-foreground">{workspaceName ?? "This workspace"}</span>
              </SettingRow>
            )}
          </SettingRows>
        </div>

        {state === "not-installed" && (
          <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
            Load the Tacto extension in Chrome (chrome://extensions → Developer mode → Load unpacked),
            then Refresh.
          </p>
        )}
      </SettingSection>
    </SettingsPage>
  )
}
