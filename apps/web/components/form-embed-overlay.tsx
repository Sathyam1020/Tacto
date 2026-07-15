"use client"

import * as React from "react"

import { Dialog, DialogContent } from "@workspace/ui/components/dialog"

import { PublicFormView } from "@/components/public-form-view"
import { useGuideTrackerContext } from "@/lib/guide-tracker"
import type { PublicGuideEmbed } from "@/lib/public-guide"

/**
 * Renders one guide form embed as an OVERLAY (modal/sheet) — never a step. It
 * opens when its trigger fires (a delay timer, or the anchored step scrolling
 * into view via `[data-step-key]`), respects show-once per reader, and hosts the
 * public form inline.
 */
export function FormEmbedOverlay({
  embed,
  guideId,
}: {
  embed: PublicGuideEmbed
  guideId: string
}) {
  const seenKey = `tacto:embed-seen:${guideId}:${embed.id}`
  const [open, setOpen] = React.useState(false)
  const [settled, setSettled] = React.useState(false) // dismissed/completed → gone
  const { track } = useGuideTrackerContext()

  // Analytics: the overlay was shown (once per form, deduped by the tracker).
  React.useEffect(() => {
    if (open) track("embed_open", { formId: embed.formId })
  }, [open, track, embed.formId])

  // Respect show-once (per browser).
  React.useEffect(() => {
    if (!embed.showOnce) return
    try {
      if (localStorage.getItem(seenKey)) setSettled(true)
    } catch {
      /* ignore */
    }
  }, [embed.showOnce, seenKey])

  // Fire the trigger.
  React.useEffect(() => {
    if (settled) return
    if (embed.trigger.kind === "after-delay") {
      const t = setTimeout(() => setOpen(true), embed.trigger.seconds * 1000)
      return () => clearTimeout(t)
    }
    // after-step: watch the anchored step scroll into view.
    const stepKey = embed.trigger.stepKey
    let io: IntersectionObserver | undefined
    const attach = () => {
      const el = document.querySelector(`[data-step-key="${stepKey}"]`)
      if (!el) return false
      io = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            setOpen(true)
            io?.disconnect()
          }
        },
        { threshold: 0.4 }
      )
      io.observe(el)
      return true
    }
    // The target may mount after this effect (view switch); retry briefly.
    if (!attach()) {
      const iv = setInterval(() => {
        if (attach()) clearInterval(iv)
      }, 500)
      return () => {
        clearInterval(iv)
        io?.disconnect()
      }
    }
    return () => io?.disconnect()
  }, [settled, embed.trigger])

  function markSeen() {
    if (embed.showOnce) {
      try {
        localStorage.setItem(seenKey, "1")
      } catch {
        /* ignore */
      }
    }
  }

  function onOpenChange(next: boolean) {
    if (!next) {
      if (!embed.dismissible) return // require completion
      setOpen(false)
      setSettled(true)
      markSeen()
    }
  }

  if (settled && !open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg" showCloseButton={embed.dismissible}>
        <div className="max-h-[80vh] overflow-y-auto">
          <PublicFormView
            form={{
              shareId: embed.form.shareId ?? "",
              title: "",
              description: null,
              document: embed.form.document,
              version: embed.form.version,
            }}
            embedded
            embedGuideId={guideId}
            onComplete={() => {
              markSeen()
              track("embed_submit", { formId: embed.formId })
              // Close shortly after the thank-you shows.
              setTimeout(() => {
                setOpen(false)
                setSettled(true)
              }, 2500)
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
