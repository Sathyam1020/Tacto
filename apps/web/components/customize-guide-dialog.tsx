"use client"

import * as React from "react"
import {
  Check,
  ChevronDown,
  CircleDot,
  Crosshair,
  MousePointer2,
  Pause,
  Play,
  SquareDashed,
} from "lucide-react"
import { toast } from "sonner"

import {
  DEFAULT_CUSTOMIZATION,
  type GuideCustomization,
} from "@workspace/contracts/guide"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { cn } from "@workspace/ui/lib/utils"

import { resolveCustomization, uploadStepMedia } from "@/lib/guides"

/* ── small controls ──────────────────────────────────────────────────────── */

function Field({
  label,
  desc,
  children,
}: {
  label: string
  desc?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <div className="min-w-0">
        <p className="text-[15px] font-medium">{label}</p>
        {desc && <p className="mt-0.5 text-[13px] text-muted-foreground">{desc}</p>}
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  )
}

function Select<T extends string | number>({
  value,
  onChange,
  options,
  className,
  disabled,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; icon?: React.ReactNode }[]
  className?: string
  disabled?: boolean
}) {
  const current = options.find((o) => o.value === value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn("min-w-44 justify-between", className)}
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          {current?.icon}
          <span className="truncate">{current?.label ?? String(value)}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-72 w-[--anchor-width] overflow-y-auto">
        {options.map((o) => (
          <DropdownMenuItem key={String(o.value)} onClick={() => onChange(o.value)}>
            {o.icon && <span className="text-muted-foreground">{o.icon}</span>}
            <span className="flex-1 truncate">{o.label}</span>
            {o.value === value && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ── option lists ────────────────────────────────────────────────────────── */

const DEFAULT_VIEW = [
  { value: "scroll-default", label: "List view as default" },
  { value: "walkthrough-default", label: "Interactive view as default" },
  { value: "only-scroll", label: "Only list view" },
  { value: "only-walkthrough", label: "Only interactive view" },
] as const
const PAGE_LAYOUT = [
  { value: "extremely-narrow", label: "Extremely Narrow" },
  { value: "narrow", label: "Narrow" },
  { value: "moderate", label: "Moderate" },
  { value: "wide", label: "Wide" },
  { value: "extremely-wide", label: "Extremely Wide" },
] as const
const HOTSPOT_TYPE = [
  { value: "default", label: "Default", icon: <Crosshair className="size-4" /> },
  {
    value: "glowing-circle",
    label: "Glowing Circle",
    icon: <CircleDot className="size-4" />,
  },
  { value: "cursor", label: "Cursor", icon: <MousePointer2 className="size-4" /> },
  {
    value: "highlight-box",
    label: "Highlight Box",
    icon: <SquareDashed className="size-4" />,
  },
] as const
const HOTSPOT_SIZE = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((v) => ({
  value: v,
  label: v === 1 ? "Default" : `${v}x`,
}))
const FONTS = [
  "DM Sans",
  "Inter",
  "Geist",
  "Roboto",
  "Poppins",
  "Montserrat",
  "Lato",
  "Open Sans",
].map((f) => ({ value: f, label: f }))
const INITIAL_ZOOM = [1, 1.5, 2].map((v) => ({ value: v, label: `${v}x` }))
const ZOOM_DELAY = Array.from({ length: 21 }, (_, i) => {
  const v = Math.round(i * 0.1 * 10) / 10
  return { value: v, label: `${v.toFixed(1)}s` }
})
const IMAGE_SCALING = [
  { value: "fit-to-width", label: "Fit to width" },
  { value: "native-size", label: "Native size" },
] as const
const ZOOM_LEVEL = [
  { value: 1, label: "No Zoom" },
  ...[1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2].map((v) => ({
    value: v,
    label: `${v}x`,
  })),
]

/* ── the dialog ──────────────────────────────────────────────────────────── */

export function CustomizeGuideDialog({
  guideId,
  value,
  onApply,
  open,
  onOpenChange,
}: {
  guideId: string
  /** The editor's current customization (working copy). */
  value: GuideCustomization | null
  /** Stage the edited customization into the editor (persisted on Update). */
  onApply: (next: GuideCustomization) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [draft, setDraft] = React.useState<GuideCustomization>(() =>
    resolveCustomization(value)
  )
  // Reseed from the working copy each time the dialog opens (discards an
  // abandoned edit). `value` is stable editor state, so this only fires on open.
  React.useEffect(() => {
    if (open) setDraft(resolveCustomization(value))
  }, [open, value])

  const [logoUploading, setLogoUploading] = React.useState(false)
  const logoInputRef = React.useRef<HTMLInputElement>(null)
  const [musicUploading, setMusicUploading] = React.useState(false)
  const musicInputRef = React.useRef<HTMLInputElement>(null)
  const musicPreviewRef = React.useRef<HTMLAudioElement | null>(null)
  const [musicPlaying, setMusicPlaying] = React.useState(false)
  React.useEffect(() => () => musicPreviewRef.current?.pause(), [])
  // Stop the preview whenever the dialog closes (it stays mounted, so the
  // unmount cleanup above isn't enough).
  React.useEffect(() => {
    if (!open) {
      musicPreviewRef.current?.pause()
      setMusicPlaying(false)
    }
  }, [open])

  // Immutable section updaters.
  const g = draft.general
  const b = draft.brand
  const s = draft.scrollView
  const w = draft.walkthroughView
  const f = draft.feedback

  // Preview the background music at the current volume (audition + set level).
  const musicUrl = w.backgroundMusic.url
  const musicVolume = w.backgroundMusic.volume
  React.useEffect(() => {
    if (musicPreviewRef.current) musicPreviewRef.current.volume = musicVolume
  }, [musicVolume])
  function toggleMusicPreview() {
    const existing = musicPreviewRef.current
    if (existing && !existing.paused) {
      existing.pause()
      setMusicPlaying(false)
      return
    }
    if (!musicUrl) return
    const el = existing?.src === musicUrl ? existing : new Audio(musicUrl)
    el.loop = true
    el.volume = musicVolume
    el.onpause = () => setMusicPlaying(false)
    musicPreviewRef.current = el
    void el
      .play()
      .then(() => setMusicPlaying(true))
      .catch(() => setMusicPlaying(false))
  }
  const setGeneral = (v: Partial<GuideCustomization["general"]>) =>
    setDraft((d) => ({ ...d, general: { ...d.general, ...v } }))
  const setBrand = (v: Partial<GuideCustomization["brand"]>) =>
    setDraft((d) => ({ ...d, brand: { ...d.brand, ...v } }))
  const setScroll = (v: Partial<GuideCustomization["scrollView"]>) =>
    setDraft((d) => ({ ...d, scrollView: { ...d.scrollView, ...v } }))
  const setWalk = (v: Partial<GuideCustomization["walkthroughView"]>) =>
    setDraft((d) => ({ ...d, walkthroughView: { ...d.walkthroughView, ...v } }))
  const setFeedback = (v: Partial<GuideCustomization["feedback"]>) =>
    setDraft((d) => ({ ...d, feedback: { ...d.feedback, ...v } }))

  const navBarEligible =
    g.pageLayout === "extremely-narrow" ||
    g.pageLayout === "narrow" ||
    g.pageLayout === "moderate"

  async function onLogoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // allow re-selecting the same file
    if (!file) return
    setLogoUploading(true)
    try {
      const key = await uploadStepMedia(guideId, file)
      // Show the picked file immediately; the server presigns the key on the
      // next read. logoUrl is display-only and stripped on save.
      setBrand({ logoKey: key, logoUrl: URL.createObjectURL(file) })
    } catch {
      toast.error("Couldn't upload logo")
    } finally {
      setLogoUploading(false)
    }
  }

  async function onMusicSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setMusicUploading(true)
    try {
      const key = await uploadStepMedia(guideId, file)
      setWalk({
        backgroundMusic: {
          ...w.backgroundMusic,
          key,
          url: URL.createObjectURL(file),
        },
      })
    } catch {
      toast.error("Couldn't upload track")
    } finally {
      setMusicUploading(false)
    }
  }

  // Stage the edit into the editor's working copy (previewed immediately);
  // it persists to the published guide only when the editor clicks Save.
  function onApplyDraft() {
    onApply(draft)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="flex-row items-center justify-between border-b px-6 py-4">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Customization
          </DialogTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDraft(DEFAULT_CUSTOMIZATION)}
          >
            Apply Default Customization
          </Button>
        </DialogHeader>

        <Tabs defaultValue="general" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-6 mt-3 w-fit">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="brand">Brand</TabsTrigger>
            <TabsTrigger value="scroll">List View</TabsTrigger>
            <TabsTrigger value="walkthrough">Interactive View</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
            {/* General */}
            <TabsContent value="general" className="divide-y">
              <Field
                label="Default View"
                desc="Changes take effect when viewing your published guide"
              >
                <Select
                  value={g.defaultView}
                  onChange={(v) => setGeneral({ defaultView: v })}
                  options={DEFAULT_VIEW as unknown as { value: typeof g.defaultView; label: string }[]}
                />
              </Field>
              <Field
                label="Page Layout"
                desc="Content width of the published guide"
              >
                <Select
                  value={g.pageLayout}
                  onChange={(v) => setGeneral({ pageLayout: v })}
                  options={PAGE_LAYOUT as unknown as { value: typeof g.pageLayout; label: string }[]}
                />
              </Field>
              <Field
                label="Hotspot Type"
                desc="Choose how you'd like the click targets to appear"
              >
                <Select
                  value={g.hotspot.type}
                  onChange={(v) =>
                    setGeneral({ hotspot: { ...g.hotspot, type: v } })
                  }
                  options={HOTSPOT_TYPE as unknown as { value: typeof g.hotspot.type; label: string }[]}
                />
              </Field>
              <Field label="Hotspot Size">
                <Select
                  value={g.hotspot.size}
                  onChange={(v) =>
                    setGeneral({ hotspot: { ...g.hotspot, size: v } })
                  }
                  options={HOTSPOT_SIZE}
                  className="min-w-32"
                />
              </Field>
            </TabsContent>

            {/* Brand */}
            <TabsContent value="brand" className="divide-y">
              <Field label="Logo" desc="Shown at the top of your published guide">
                <div className="flex items-center gap-2">
                  {b.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.logoUrl}
                      alt=""
                      className="bg-card h-9 w-auto max-w-24 rounded border object-contain p-1"
                    />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={logoUploading}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {logoUploading
                      ? "Uploading…"
                      : b.logoUrl
                        ? "Replace"
                        : "Upload"}
                  </Button>
                  {b.logoUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setBrand({ logoKey: null, logoUrl: null })}
                    >
                      Remove
                    </Button>
                  )}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={onLogoSelected}
                  />
                </div>
              </Field>
              <Field label="Brand Color" desc="Accent color for the published guide">
                <div className="flex items-center gap-2">
                  <Input
                    value={b.color}
                    onChange={(e) => setBrand({ color: e.target.value })}
                    className="w-28 font-mono"
                  />
                  <input
                    type="color"
                    value={b.color}
                    onChange={(e) => setBrand({ color: e.target.value })}
                    aria-label="Brand color"
                    className="size-9 cursor-pointer rounded-md border bg-transparent"
                  />
                </div>
              </Field>
              <Field label="Font">
                <Select
                  value={b.font}
                  onChange={(v) => setBrand({ font: v })}
                  options={FONTS as unknown as { value: typeof b.font; label: string }[]}
                />
              </Field>
              <Field
                label="RTL Layout"
                desc="Enable for RTL languages (Arabic, Hebrew, Urdu). Applies to the published guide and PDF."
              >
                <Switch
                  checked={b.rtl}
                  onCheckedChange={(v) => setBrand({ rtl: v })}
                />
              </Field>
            </TabsContent>

            {/* Scroll View */}
            <TabsContent value="scroll" className="divide-y">
              <Field
                label="Navigation Bar"
                desc="Only applies to Extremely Narrow, Narrow or Moderate layouts"
              >
                <Switch
                  checked={s.navigationBar}
                  disabled={!navBarEligible}
                  onCheckedChange={(v) => setScroll({ navigationBar: v })}
                />
              </Field>
              <Field
                label="Initial Zoom"
                desc="How much to initially zoom to the hotspot on an image"
              >
                <Select
                  value={s.initialZoom}
                  onChange={(v) => setScroll({ initialZoom: v })}
                  options={INITIAL_ZOOM}
                  className="min-w-28"
                />
              </Field>
              <Field
                label="Zoom Delay"
                desc="How long to wait after a step becomes visible before zooming"
              >
                <Select
                  value={s.zoomDelay}
                  onChange={(v) => setScroll({ zoomDelay: v })}
                  options={ZOOM_DELAY}
                  className="min-w-28"
                />
              </Field>
              <Field
                label="Image Scaling"
                desc="How to scale step images (overridable per step)"
              >
                <Select
                  value={s.imageScaling}
                  onChange={(v) => setScroll({ imageScaling: v })}
                  options={IMAGE_SCALING as unknown as { value: typeof s.imageScaling; label: string }[]}
                />
              </Field>
            </TabsContent>

            {/* Walkthrough View */}
            <TabsContent value="walkthrough" className="divide-y">
              <Field label="Text annotations" desc="Disable to hide text annotations">
                <Switch
                  checked={w.textAnnotations}
                  onCheckedChange={(v) => setWalk({ textAnnotations: v })}
                />
              </Field>
              <Field
                label="Show step counter in annotations"
                desc="Hide the current/total step count in annotations"
              >
                <Switch
                  checked={w.showStepCounter}
                  onCheckedChange={(v) => setWalk({ showStepCounter: v })}
                />
              </Field>
              <Field
                label="Use Markdown"
                desc="If disabled, only the 1st line shows and links are off"
              >
                <Switch
                  checked={w.useMarkdown}
                  onCheckedChange={(v) => setWalk({ useMarkdown: v })}
                />
              </Field>
              <Field
                label="Zoom Level"
                desc="Default zoom for step images (overridable per step)"
              >
                <Select
                  value={w.zoomLevel}
                  onChange={(v) => setWalk({ zoomLevel: v })}
                  options={ZOOM_LEVEL}
                  className="min-w-28"
                />
              </Field>
              <Field
                label="Optimize for mobile"
                desc="Show text annotations at the bottom on mobile"
              >
                <Switch
                  checked={w.optimizeForMobile}
                  onCheckedChange={(v) => setWalk({ optimizeForMobile: v })}
                />
              </Field>

              {/* Background music */}
              <div className="py-4">
                <Field
                  label="Background music"
                  desc="Plays on loop during the interactive walkthrough"
                >
                  <div className="flex items-center gap-2">
                    {w.backgroundMusic.url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setWalk({
                            backgroundMusic: {
                              ...w.backgroundMusic,
                              key: null,
                              url: null,
                            },
                          })
                        }
                      >
                        Remove
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={musicUploading}
                      onClick={() => musicInputRef.current?.click()}
                    >
                      {musicUploading
                        ? "Uploading…"
                        : w.backgroundMusic.url
                          ? "Replace"
                          : "Upload track"}
                    </Button>
                    <input
                      ref={musicInputRef}
                      type="file"
                      accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/mp4,.mp3,.wav,.ogg,.m4a"
                      className="hidden"
                      onChange={onMusicSelected}
                    />
                  </div>
                </Field>
                {w.backgroundMusic.url && (
                  <div className="mt-1 flex items-center gap-3 rounded-lg bg-muted/50 p-4">
                    <button
                      type="button"
                      aria-label={musicPlaying ? "Pause preview" : "Play preview"}
                      onClick={toggleMusicPreview}
                      className="bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-full transition hover:opacity-90"
                    >
                      {musicPlaying ? (
                        <Pause className="size-4" />
                      ) : (
                        <Play className="size-4" />
                      )}
                    </button>
                    <span className="text-sm whitespace-nowrap">Volume</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={w.backgroundMusic.volume}
                      onChange={(e) =>
                        setWalk({
                          backgroundMusic: {
                            ...w.backgroundMusic,
                            volume: Number(e.target.value),
                          },
                        })
                      }
                      className="accent-primary flex-1"
                    />
                    <span className="text-muted-foreground w-9 text-right font-mono text-xs tabular-nums">
                      {Math.round(w.backgroundMusic.volume * 100)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Autoplay */}
              <div className="py-4">
                <Field
                  label="Autoplay"
                  desc="Automatically play the interactive view from start to finish"
                >
                  <Switch
                    checked={w.autoplay.enabled}
                    onCheckedChange={(v) =>
                      setWalk({ autoplay: { ...w.autoplay, enabled: v } })
                    }
                  />
                </Field>
                {w.autoplay.enabled && (
                  <div className="mt-1 flex flex-col gap-3 rounded-lg bg-muted/50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Delay (seconds)</span>
                      <Input
                        type="number"
                        min={0}
                        value={w.autoplay.delaySeconds}
                        onChange={(e) =>
                          setWalk({
                            autoplay: {
                              ...w.autoplay,
                              delaySeconds: Number(e.target.value) || 0,
                            },
                          })
                        }
                        className="w-24"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Loop</span>
                      <Switch
                        checked={w.autoplay.loop}
                        onCheckedChange={(v) =>
                          setWalk({ autoplay: { ...w.autoplay, loop: v } })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Call-to-Action */}
              <div className="py-4">
                <Field
                  label="Call-to-Action"
                  desc="Show a call-to-action at the end of the interactive view"
                >
                  <Switch
                    checked={w.cta.enabled}
                    onCheckedChange={(v) =>
                      setWalk({ cta: { ...w.cta, enabled: v } })
                    }
                  />
                </Field>
                {w.cta.enabled && (
                  <div className="mt-1 flex flex-col gap-3 rounded-lg bg-muted/50 p-4">
                    <LabeledInput
                      label="Title"
                      value={w.cta.title}
                      onChange={(v) => setWalk({ cta: { ...w.cta, title: v } })}
                    />
                    <LabeledInput
                      label="Subtitle"
                      value={w.cta.subtitle}
                      onChange={(v) => setWalk({ cta: { ...w.cta, subtitle: v } })}
                    />
                    <LabeledInput
                      label="Button Text"
                      value={w.cta.buttonText}
                      onChange={(v) =>
                        setWalk({ cta: { ...w.cta, buttonText: v } })
                      }
                    />
                    <LabeledInput
                      label="Button URL"
                      value={w.cta.buttonUrl}
                      onChange={(v) => setWalk({ cta: { ...w.cta, buttonUrl: v } })}
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Feedback */}
            <TabsContent value="feedback" className="divide-y">
              <Field label="Allow Reactions" desc="Allow anyone to react to this guide">
                <Switch
                  checked={f.allowReactions}
                  onCheckedChange={(v) => setFeedback({ allowReactions: v })}
                />
              </Field>
              <Field
                label="Allow Comments"
                desc="Allow your team members to comment on this guide"
              >
                <Switch
                  checked={f.allowComments}
                  onCheckedChange={(v) => setFeedback({ allowComments: v })}
                />
              </Field>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
          <p className="text-muted-foreground text-xs">
            Changes preview here and go live when you Update the guide.
          </p>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onApplyDraft}>Apply</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function LabeledInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm whitespace-nowrap">{label}</span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-xs"
      />
    </div>
  )
}
