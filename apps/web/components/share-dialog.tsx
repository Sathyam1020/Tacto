"use client"

import * as React from "react"
import { Check, Copy, Globe } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Switch } from "@workspace/ui/components/switch"

import { usePublishGuide, type GuideDetail } from "@/lib/guides"

/**
 * Share dialog — publish toggle + copyable public link. Publishing mints an
 * unlisted shareId; anyone with the link can view (no login).
 */
export function ShareDialog({
  guide,
  open,
  onOpenChange,
}: {
  guide: GuideDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const publish = usePublishGuide(guide.id)
  const [copied, setCopied] = React.useState(false)

  const published = guide.status === "PUBLISHED"
  const shareUrl =
    guide.shareId && typeof window !== "undefined"
      ? `${window.location.origin}/g/${guide.shareId}`
      : ""

  async function copy() {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-medium tracking-tight">
            Share this guide
          </DialogTitle>
          <DialogDescription>
            {published
              ? "Anyone with the link can view this guide."
              : "Publish to get a shareable link."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-2.5">
            <Globe className="text-muted-foreground size-4" />
            <div>
              <p className="text-sm font-medium">Public link</p>
              <p className="text-muted-foreground text-xs">
                {published ? "Published" : "Draft — not shared"}
              </p>
            </div>
          </div>
          <Switch
            checked={published}
            disabled={publish.isPending}
            onCheckedChange={(next) => publish.mutate(next)}
          />
        </div>

        {published && shareUrl && (
          <div className="flex gap-2">
            <Input readOnly value={shareUrl} className="font-mono text-xs" />
            <Button variant="secondary" onClick={copy}>
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
