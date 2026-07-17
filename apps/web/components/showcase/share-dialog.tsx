"use client"

import * as React from "react"
import { Check, Code2, Copy, Globe, Link2, QrCode } from "lucide-react"
import { toast } from "sonner"

import type { ShowcaseDetail } from "@workspace/contracts/showcase"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { cn } from "@workspace/ui/lib/utils"

import { QrCode as QrCodeView } from "@/components/guide/qr-code"
import { usePublishShowcase } from "@/lib/showcase"

/**
 * The distribution hub for a showcase — visibility, public link, QR code, and
 * embeds (iframe · script · popup) via the Tacto SDK (`data-tacto-showcase`).
 * Mirrors the guide Share dialog; a showcase has no reader "mode".
 */
export function ShowcaseShareDialog({
  sc,
  open,
  onOpenChange,
}: {
  sc: ShowcaseDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const publish = usePublishShowcase(sc.id)
  const published = sc.status === "PUBLISHED"
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const shareUrl = `${origin}/showcase/${sc.slug}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="truncate font-serif text-xl font-medium tracking-tight">
            Share &amp; embed
          </DialogTitle>
          <DialogDescription>
            {published
              ? "Anyone with the link can view this showcase."
              : "Publish the showcase to share, embed, and get a QR code."}
          </DialogDescription>
        </DialogHeader>

        {/* Visibility — the master switch. */}
        <div className="flex items-center justify-between rounded-xl border border-[var(--l-hairline)] p-3.5">
          <div className="flex items-center gap-2.5">
            <span className={cn("flex size-8 items-center justify-center rounded-lg", published ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
              <Globe className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium">{published ? "Public" : "Draft"}</p>
              <p className="text-xs text-muted-foreground">
                {published ? "Live — anyone with the link" : "Only your workspace can see it"}
              </p>
            </div>
          </div>
          <Switch
            checked={published}
            disabled={publish.isPending}
            onCheckedChange={(next) => publish.mutate(next)}
            aria-label="Public visibility"
          />
        </div>

        {published ? (
          <Tabs defaultValue="distribution" className="mt-1">
            <TabsList className="w-full">
              <TabsTrigger value="distribution" className="flex-1 gap-1.5">
                <Link2 className="size-3.5" /> Distribution
              </TabsTrigger>
              <TabsTrigger value="developer" className="flex-1 gap-1.5">
                <Code2 className="size-3.5" /> Developer
              </TabsTrigger>
            </TabsList>

            <TabsContent value="distribution" className="mt-4 flex flex-col gap-4">
              <Field label="Public link">
                <div className="flex gap-2">
                  <Input readOnly value={shareUrl} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                  <CopyButton value={shareUrl} label="link" />
                </div>
              </Field>
              <Field label="QR code" icon={<QrCode className="size-3.5" />}>
                <QrCodeView value={shareUrl} filename={`${sc.slug}-qr.png`} />
              </Field>
            </TabsContent>

            <TabsContent value="developer" className="mt-4">
              <DeveloperTab origin={origin} slug={sc.slug} title={sc.title} />
            </TabsContent>
          </Tabs>
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--l-hairline-strong)] px-4 py-8 text-center text-[13px] text-muted-foreground">
            Turn on <span className="font-medium text-foreground">Public</span> to get a link, QR code, and embeds.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DeveloperTab({ origin, slug, title }: { origin: string; slug: string; title: string }) {
  const embed = `${origin}/embed/showcase/${slug}`
  const snippets = {
    iframe: `<iframe src="${embed}" style="width:100%;min-height:640px;border:0;border-radius:12px" allow="fullscreen" loading="lazy" title="${escapeAttr(title)}"></iframe>`,
    script: `<script src="${origin}/embed.js" async></script>\n<div data-tacto-showcase="${slug}"></div>`,
    popup: `<script src="${origin}/embed.js" async></script>\n<button data-tacto-showcase-popup="${slug}">Explore</button>`,
  }
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Snippet label="Inline (iframe)" hint="Drop into any page — Notion, Framer, plain HTML." code={snippets.iframe} />
      <Snippet label="Inline (script)" hint="Auto-resizing embed via the Tacto SDK." code={snippets.script} />
      <Snippet label="Popup" hint="A launcher button that opens the showcase in a modal." code={snippets.popup} />
    </div>
  )
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium">
        {icon}
        {label}
      </p>
      {children}
    </div>
  )
}

function Snippet({ label, hint, code }: { label: string; hint?: string; code: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[13px] font-medium">{label}</p>
        <CopyButton value={code} label={label} compact />
      </div>
      {hint && <p className="mb-1.5 text-[12px] text-muted-foreground">{hint}</p>}
      <pre className="w-full min-w-0 rounded-lg border border-[var(--l-hairline)] bg-[var(--l-chrome)] p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all text-foreground">
        {code}
      </pre>
    </div>
  )
}

function CopyButton({ value, label, compact }: { value: string; label: string; compact?: boolean }) {
  const [copied, setCopied] = React.useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error(`Couldn't copy the ${label}`)
    }
  }
  if (compact) {
    return (
      <button onClick={copy} className="flex items-center gap-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground">
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    )
  }
  return (
    <Button variant="secondary" onClick={copy} aria-label={`Copy ${label}`}>
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </Button>
  )
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;")
}
