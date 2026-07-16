"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Check, ChevronDown, Code2, Copy, Globe, Layers, LibraryBig, Link2, Plus, QrCode } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { Switch } from "@workspace/ui/components/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { cn } from "@workspace/ui/lib/utils"

import { QrCode as QrCodeView } from "@/components/guide/qr-code"
import { useAddArticles, useGuidePlacement, useHelpCenter } from "@/lib/help-center"
import { usePublishGuide, type GuideDetail } from "@/lib/guides"

type Mode = "list" | "interactive"

/**
 * The single distribution hub for a guide — visibility, public link, QR code,
 * embeds, and content-hub placement. This is the ONLY publish/distribution
 * surface (the editor authors; it does not publish).
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
  const published = guide.status === "PUBLISHED"
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const shareUrl = guide.shareId ? `${origin}/g/${guide.shareId}` : ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="truncate font-serif text-xl font-medium tracking-tight">
            Share &amp; distribute
          </DialogTitle>
          <DialogDescription>
            {published
              ? "Anyone with the link can view this guide."
              : "Make the guide public to share, embed, and add it to your hubs."}
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

        {published && guide.shareId ? (
          <Tabs defaultValue="distribution" className="mt-1">
            <TabsList className="w-full">
              <TabsTrigger value="distribution" className="flex-1 gap-1.5">
                <Link2 className="size-3.5" /> Distribution
              </TabsTrigger>
              <TabsTrigger value="developer" className="flex-1 gap-1.5">
                <Code2 className="size-3.5" /> Developer
              </TabsTrigger>
              <TabsTrigger value="hubs" className="flex-1 gap-1.5">
                <LibraryBig className="size-3.5" /> Hubs
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
                <QrCodeView value={shareUrl} filename={`${slugify(guide.title)}-qr.png`} />
              </Field>
            </TabsContent>

            <TabsContent value="developer" className="mt-4">
              <DeveloperTab origin={origin} shareId={guide.shareId} title={guide.title} />
            </TabsContent>

            <TabsContent value="hubs" className="mt-4">
              <HubsTab guideId={guide.id} />
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

/* ── developer (embeds) ──────────────────────────────────────────────────── */
function DeveloperTab({ origin, shareId, title }: { origin: string; shareId: string; title: string }) {
  const [mode, setMode] = React.useState<Mode>("interactive")
  const embed = `${origin}/embed/g/${shareId}`
  const snippets = {
    iframe: `<iframe src="${embed}?mode=${mode}" style="width:100%;aspect-ratio:16/10;border:0;border-radius:12px" allow="fullscreen" loading="lazy" title="${escapeAttr(title)}"></iframe>`,
    script: `<script src="${origin}/embed.js" async></script>\n<div data-tacto-guide="${shareId}" data-tacto-mode="${mode}"></div>`,
    popup: `<script src="${origin}/embed.js" async></script>\n<button data-tacto-guide-popup="${shareId}" data-tacto-mode="${mode}">Show me how</button>`,
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium">Mode</p>
        <div className="inline-flex rounded-lg bg-muted p-0.5">
          {(["list", "interactive"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <Snippet label="Inline (iframe)" hint="Drop into any page — Notion, Framer, plain HTML." code={snippets.iframe} />
      <Snippet label="Inline (script)" hint="Auto-resizing embed via the Tacto SDK." code={snippets.script} />
      <Snippet label="Popup" hint="A launcher button that opens the guide in a modal." code={snippets.popup} />
    </div>
  )
}

/* ── hubs ────────────────────────────────────────────────────────────────── */
function HubsTab({ guideId }: { guideId: string }) {
  const { data: hc } = useHelpCenter()
  const placement = useGuidePlacement(guideId)
  const add = useAddArticles()
  const qc = useQueryClient()

  const inIds = new Set((placement.data?.collections ?? []).map((c) => c.id))
  const addable = (hc?.collections ?? []).filter((c) => !inIds.has(c.id))
  const current = placement.data?.collections ?? []

  function addTo(collectionId: string, name: string) {
    add.mutate(
      { collectionId, guideIds: [guideId] },
      {
        onSuccess: () => {
          toast.success(`Added to ${name}`)
          void qc.invalidateQueries({ queryKey: ["guide-help-placement", guideId] })
        },
        onError: () => toast.error("Couldn't add to the collection"),
      }
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-2 flex items-center gap-2 text-[13px] font-medium">
          <LibraryBig className="size-4 text-muted-foreground" /> Help Center
        </div>
        {current.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {current.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[12px] font-medium text-primary">
                <Check className="size-3" /> {c.name}
              </span>
            ))}
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" disabled={addable.length === 0 || add.isPending} />}
          >
            <Plus className="size-4" />
            {current.length > 0 ? "Add to another collection" : "Add to a collection"}
            <ChevronDown className="size-4 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-56 w-56 overflow-y-auto">
            {addable.map((c) => (
              <DropdownMenuItem key={c.id} onClick={() => addTo(c.id, c.name)}>
                {c.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {addable.length === 0 && current.length === 0 && (
          <p className="text-[12px] text-muted-foreground">Create a collection in the Help Center first.</p>
        )}
      </div>

      <div className="opacity-60">
        <div className="mb-1 flex items-center gap-2 text-[13px] font-medium">
          <Layers className="size-4 text-muted-foreground" /> Collection
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Soon</span>
        </div>
        <p className="text-[12px] text-muted-foreground">Group guides into a shareable, embeddable showcase.</p>
      </div>
    </div>
  )
}

/* ── bits ────────────────────────────────────────────────────────────────── */
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
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[13px] font-medium">{label}</p>
        <CopyButton value={code} label={label} compact />
      </div>
      {hint && <p className="mb-1.5 text-[12px] text-muted-foreground">{hint}</p>}
      <pre className="overflow-x-auto rounded-lg border border-[var(--l-hairline)] bg-[var(--l-chrome)] p-3 font-mono text-[11px] leading-relaxed text-foreground">
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

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "guide"
}
function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;")
}
