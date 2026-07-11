"use client"

import * as React from "react"
import { Plus, Video } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { api } from "@/lib/api"
import {
  ExtensionError,
  listTabs,
  startOnTab,
  type BrowserTab,
} from "@/lib/extension"

/**
 * Navbar Capture button — opens a tab picker (tabs come from the extension),
 * and starts recording on the chosen tab. Replaces the old screen-share.
 */
export function CaptureButton({
  variant = "button",
  folderId = null,
}: {
  /** "card" renders the dashed library placeholder tile instead of a button. */
  variant?: "button" | "card"
  /** Folder the resulting guide should land in (null = default folder). */
  folderId?: string | null
}) {
  const [open, setOpen] = React.useState(false)
  const [tabs, setTabs] = React.useState<BrowserTab[] | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [startingId, setStartingId] = React.useState<number | null>(null)
  const [startedIn, setStartedIn] = React.useState<string | null>(null)
  const [needsReload, setNeedsReload] = React.useState(false)

  /** A severed bridge is only fixed by reloading the page; say so explicitly. */
  function reportExtensionError(e: unknown, fallback: string) {
    if (e instanceof ExtensionError && e.reason === "severed") {
      setNeedsReload(true)
      setError("Tacto lost its connection. Reload this page and try again.")
    } else {
      setNeedsReload(false)
      setError(fallback)
    }
  }

  async function openPicker() {
    setOpen(true)
    setTabs(null)
    setError(null)
    setNeedsReload(false)
    setLoading(true)
    try {
      const list = await listTabs()
      // Don't offer the Tacto tab itself.
      setTabs(list.filter((t) => !t.url.startsWith(window.location.origin)))
    } catch (e) {
      reportExtensionError(
        e,
        "Couldn't reach the Tacto extension. Make sure it's installed and connected."
      )
    } finally {
      setLoading(false)
    }
  }

  async function pick(tab: BrowserTab) {
    setStartingId(tab.id)
    setError(null)
    try {
      // Record the target folder server-side first (reliable even if the
      // extension can't carry it), then start recording.
      try {
        await api.post("/captures/intent", { folderId: folderId ?? null })
      } catch {
        // Non-fatal: the capture still records; it just lands in the default.
      }
      await startOnTab(tab.id, folderId)
      setOpen(false)
      setStartedIn(tab.title)
      window.setTimeout(() => setStartedIn(null), 4000)
    } catch (e) {
      reportExtensionError(e, "Couldn't start recording on that tab. Try again.")
    } finally {
      setStartingId(null)
    }
  }

  return (
    <>
      {variant === "card" ? (
        <Button
          onClick={openPicker}
          className="group/add flex h-full min-h-[230px] w-full flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-[var(--l-hairline-strong)] bg-[var(--l-placeholder)] text-muted-foreground transition-colors hover:border-[var(--l-hairline-strong)] hover:bg-[var(--l-placeholder-hover)] hover:text-foreground"
        >
          <span className="flex size-11 items-center justify-center rounded-full border border-[var(--l-hairline-strong)] bg-[var(--l-lift)] text-foreground transition-transform duration-200 group-hover/add:scale-105">
            <Plus className="size-5" />
          </span>
          <span className="text-[13px] font-medium">New capture</span>
          <span className="text-[11px] text-muted-foreground">
            Record a workflow to add a guide
          </span>
        </Button>
      ) : (
        <Button onClick={openPicker}>
          <Video className="size-4" />
          New capture
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-medium tracking-tight">
              Choose a tab to record
            </DialogTitle>
            <DialogDescription>
              You can also start from the Tacto extension on any tab.
            </DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          )}

          {error && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-signal">{error}</p>
              {needsReload && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.location.reload()}
                  className="shrink-0"
                >
                  Reload
                </Button>
              )}
            </div>
          )}

          {tabs && tabs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No other tabs are open. Open the page you want to document, then
              try again.
            </p>
          )}

          {tabs && tabs.length > 0 && (
            <div className="-mx-1 flex max-h-96 flex-col gap-1 overflow-y-auto px-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => pick(tab)}
                  disabled={startingId !== null}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-viridian/40 hover:bg-muted disabled:opacity-50"
                >
                  {tab.favIconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={tab.favIconUrl}
                      alt=""
                      className="size-4 shrink-0 rounded-sm"
                    />
                  ) : (
                    <span className="size-4 shrink-0 rounded-sm bg-muted" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {tab.title}
                  </span>
                  {startingId === tab.id && (
                    <span className="font-mono text-xs text-muted-foreground">
                      starting…
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {startedIn && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-full bg-ink px-4 py-2 text-sm text-paper shadow-lg">
          <span className="size-2 animate-pulse rounded-full bg-signal" />
          Recording started in “{startedIn}”
        </div>
      )}
    </>
  )
}
