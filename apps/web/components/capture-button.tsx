"use client"

import * as React from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { TouchRing } from "@workspace/ui/components/touch-ring"

import { listTabs, startOnTab, type BrowserTab } from "@/lib/extension"

/**
 * Navbar Capture button — opens a tab picker (tabs come from the extension),
 * and starts recording on the chosen tab. Replaces the old screen-share.
 */
export function CaptureButton() {
  const [open, setOpen] = React.useState(false)
  const [tabs, setTabs] = React.useState<BrowserTab[] | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [startingId, setStartingId] = React.useState<number | null>(null)
  const [startedIn, setStartedIn] = React.useState<string | null>(null)

  async function openPicker() {
    setOpen(true)
    setTabs(null)
    setError(null)
    setLoading(true)
    try {
      const list = await listTabs()
      // Don't offer the Tacto tab itself.
      setTabs(list.filter((t) => !t.url.startsWith(window.location.origin)))
    } catch {
      setError("Couldn't reach the Tacto extension. Is it connected?")
    } finally {
      setLoading(false)
    }
  }

  async function pick(tab: BrowserTab) {
    setStartingId(tab.id)
    setError(null)
    try {
      await startOnTab(tab.id)
      setOpen(false)
      setStartedIn(tab.title)
      window.setTimeout(() => setStartedIn(null), 4000)
    } catch {
      setError("Couldn't start recording on that tab.")
    } finally {
      setStartingId(null)
    }
  }

  return (
    <>
      <Button size="sm" onClick={openPicker}>
        <TouchRing size="sm" tone="neutral" />
        Capture
      </Button>

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

          {error && <p className="text-signal text-sm">{error}</p>}

          {tabs && tabs.length === 0 && (
            <p className="text-muted-foreground text-sm">
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
                  className="hover:border-viridian/40 hover:bg-muted flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-50"
                >
                  {tab.favIconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={tab.favIconUrl}
                      alt=""
                      className="size-4 shrink-0 rounded-sm"
                    />
                  ) : (
                    <span className="bg-muted size-4 shrink-0 rounded-sm" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {tab.title}
                  </span>
                  {startingId === tab.id && (
                    <span className="text-muted-foreground font-mono text-xs">
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
        <div className="bg-ink text-paper fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-full px-4 py-2 text-sm shadow-lg">
          <span className="bg-signal size-2 animate-pulse rounded-full" />
          Recording started in “{startedIn}”
        </div>
      )}
    </>
  )
}
