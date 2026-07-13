"use client"

import * as React from "react"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react"

import type { GuideCustomization } from "@workspace/contracts/guide"
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"

import { RichText } from "@/components/rich-text"
import { RichTextEditor } from "@/components/rich-text-editor"
import { HotspotGlyph } from "@/components/screenshot-frame"
import type { WalkthroughItemClient } from "@/lib/guides"

type StepItem = Extract<WalkthroughItemClient, { kind: "step" }>
type SlideItem = Exclude<WalkthroughItemClient, { kind: "step" }>
type SlideButton = SlideItem["buttons"][number]
type Appearance = SlideItem["appearance"]

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `k_${Math.round(performance.now() * 1000)}`

/** Curated slide backgrounds (CSS values). `null` = theme surface. */
const BG_PRESETS: string[] = [
  "linear-gradient(135deg,#f4f4f7,#e7e7ee)",
  "linear-gradient(135deg,#fdeeee,#f6dcdc)",
  "linear-gradient(135deg,#e7f5ef,#d6efe4)",
  "linear-gradient(135deg,#e9eefb,#d9e3f7)",
  "linear-gradient(135deg,#fdf7e6,#f6eccd)",
  "#141414",
]

function newSlide(kind: "intro" | "chapter"): SlideItem {
  return {
    kind,
    key: uid(),
    title: kind === "intro" ? "Welcome 👋" : "New chapter",
    subtitle: kind === "intro" ? "Here's a quick walkthrough." : "",
    appearance: {
      background: { kind: "none", value: null },
      theme: "light",
      align: "center",
      buttonColumns: 1,
    },
    buttons:
      kind === "intro"
        ? [
            {
              key: uid(),
              text: "Get started",
              destination: { kind: "next" },
              bgColor: "#5e6ad2",
              textColor: "#ffffff",
            },
          ]
        : [],
  }
}

/**
 * Interactive (Walkthrough) mode editor — a top toolbar (Add Intro / Add
 * Chapter + context actions), a left panel that toggles between the Steps
 * stepper and a slide Appearance panel, and a player-accurate canvas. Steps
 * show the screenshot with a floating callout; Intro/Chapter slides show an
 * editable surface with jump-to-step buttons. Edits the Interactive tree
 * independently of the List blocks; all mutations flow through the editor's
 * history (undo/redo + autosave).
 */
export function InteractiveEditor({
  items,
  customization,
  onEditContent,
  onReorder,
  onDelete,
  onInsertItem,
  onUpdateItem,
  onUploadMedia,
  onEditImage,
}: {
  items: WalkthroughItemClient[]
  customization: GuideCustomization
  onEditContent: (key: string, html: string) => void
  onReorder: (orderedKeys: string[]) => void
  onDelete: (key: string) => void
  onInsertItem: (item: WalkthroughItemClient, afterKey: string | null) => void
  onUpdateItem: (key: string, patch: Partial<WalkthroughItemClient>) => void
  onUploadMedia: (file: File) => Promise<{ key: string; url: string } | null>
  onEditImage: (
    source: { assetId: string | null; itemKey: string; scope: "block" | "step" },
    src: string
  ) => void
}) {
  const [selectedKeyRaw, setSelectedKey] = React.useState<string | null>(
    items[0]?.key ?? null
  )
  const [leftView, setLeftView] = React.useState<"steps" | "appearance">("steps")
  const [previewAppearance, setPreviewAppearance] =
    React.useState<Appearance | null>(null)
  const [editStepOpen, setEditStepOpen] = React.useState(false)
  const [editingButtonKey, setEditingButtonKey] = React.useState<string | null>(
    null
  )
  const [uploading, setUploading] = React.useState(false)
  const [dragKey, setDragKey] = React.useState<string | null>(null)
  const [overKey, setOverKey] = React.useState<string | null>(null)
  // Measured screenshot height → sizes slides so every frame is the same height.
  const [stageH, setStageH] = React.useState<number>()
  const fileRef = React.useRef<HTMLInputElement>(null)

  const selectedKey = items.some((i) => i.key === selectedKeyRaw)
    ? selectedKeyRaw
    : (items[0]?.key ?? null)
  const selIndex = items.findIndex((i) => i.key === selectedKey)
  const selected = items[selIndex] ?? null
  const firstStepUrl =
    items.find((i): i is StepItem => i.kind === "step" && !!i.screenshotUrl)
      ?.screenshotUrl ?? null

  const stepNumber = new Map<string, number>()
  let n = 0
  for (const it of items) if (it.kind === "step") stepNumber.set(it.key, ++n)

  const stepDestinations = items
    .filter((it): it is StepItem => it.kind === "step")
    .map((it) => ({ stepKey: it.key, label: `Step ${stepNumber.get(it.key)}` }))

  const goTo = (key: string) => {
    setSelectedKey(key)
    setLeftView("steps")
    setPreviewAppearance(null)
    setEditStepOpen(false)
  }

  const addSlide = (kind: "intro" | "chapter") => {
    const slide = newSlide(kind)
    onInsertItem(slide, kind === "intro" ? null : selectedKey)
    setSelectedKey(slide.key)
    setPreviewAppearance(slide.appearance)
    setLeftView("appearance")
  }

  const openAppearance = () => {
    if (selected && selected.kind !== "step") {
      setPreviewAppearance((selected as SlideItem).appearance)
      setLeftView("appearance")
    }
  }

  function handleDrop(targetKey: string) {
    setOverKey(null)
    if (!dragKey || dragKey === targetKey) return setDragKey(null)
    const keys = items.map((i) => i.key)
    const from = keys.indexOf(dragKey)
    const to = keys.indexOf(targetKey)
    if (from === -1 || to === -1) return
    keys.splice(to, 0, keys.splice(from, 1)[0]!)
    onReorder(keys)
    setDragKey(null)
  }

  async function onMediaPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !selected || selected.kind !== "step") return
    setUploading(true)
    const res = await onUploadMedia(file)
    setUploading(false)
    if (res) {
      onUpdateItem(selected.key, {
        screenshotKey: res.key,
        screenshotUrl: res.url,
        assetId: `a_${uid()}`,
      } as Partial<WalkthroughItemClient>)
    }
  }

  const isStepSel = selected?.kind === "step"
  const slideSel = selected && selected.kind !== "step" ? (selected as SlideItem) : null
  const editingButton =
    slideSel?.buttons.find((b) => b.key === editingButtonKey) ?? null

  const setSlideButtons = (slide: SlideItem, buttons: SlideButton[]) =>
    onUpdateItem(slide.key, { buttons } as Partial<WalkthroughItemClient>)

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex justify-center">
        <div className="bg-card inline-flex items-center gap-1 rounded-full border p-1 shadow-sm">
          <ToolbarButton onClick={() => addSlide("intro")}>
            <Plus className="size-4" /> Add Intro
          </ToolbarButton>
          <ToolbarButton onClick={() => addSlide("chapter")}>
            <Plus className="size-4" /> Add Chapter
          </ToolbarButton>
          {selected && (
            <>
              <span className="bg-border mx-1 h-5 w-px" />
              {isStepSel ? (
                <>
                  <ToolbarButton onClick={() => setEditStepOpen(true)}>
                    <Pencil className="size-4" /> Edit step
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    <ImagePlus className="size-4" />
                    {uploading ? "Uploading…" : "Update media"}
                  </ToolbarButton>
                </>
              ) : (
                <ToolbarButton onClick={openAppearance}>
                  <Palette className="size-4" /> Customize
                </ToolbarButton>
              )}
            </>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={onMediaPicked}
      />

      {items.length === 0 ? (
        <div className="text-muted-foreground rounded-2xl border border-dashed py-24 text-center text-sm">
          Add an Intro or Chapter, or add steps from the List view.
        </div>
      ) : (
        <div className="flex items-stretch gap-6">
          {/* Left panel */}
          {leftView === "appearance" && slideSel ? (
            <div className="relative w-[200px] shrink-0">
              <div className="absolute inset-0">
                <AppearancePanel
                  key={slideSel.key}
                initial={slideSel.appearance}
                kindLabel={slideSel.kind === "intro" ? "intro" : "chapter"}
                onPreview={setPreviewAppearance}
                onSave={(appearance) => {
                  onUpdateItem(slideSel.key, {
                    appearance,
                  } as Partial<WalkthroughItemClient>)
                  setPreviewAppearance(null)
                  setLeftView("steps")
                }}
                  onCancel={() => {
                    setPreviewAppearance(null)
                    setLeftView("steps")
                  }}
                />
              </div>
            </div>
          ) : (
            <StepsPanel
              items={items}
              selectedKey={selectedKey}
              stepNumber={stepNumber}
              dragKey={dragKey}
              overKey={overKey}
              onSelect={goTo}
              onDelete={onDelete}
              onDragKey={setDragKey}
              onOverKey={setOverKey}
              onDrop={handleDrop}
            />
          )}

          {/* Canvas */}
          <div className="min-w-0 flex-1">
            {/* Off-layout measurer: keeps `stageH` warm from the first
                screenshot so slides match the step height (constant stage). */}
            {firstStepUrl && (
              <div className="mx-auto w-full max-w-4xl">
                <div aria-hidden className="pointer-events-none h-0 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={firstStepUrl}
                    alt=""
                    className="w-full"
                    onLoad={(e) => setStageH(e.currentTarget.offsetHeight)}
                  />
                </div>
              </div>
            )}
            {isStepSel ? (
              <StepCanvas
                key={selected!.key}
                step={selected as StepItem}
                hotspot={customization.general.hotspot}
                index={selIndex}
                total={items.length}
                onEdit={() => setEditStepOpen(true)}
                onEditImage={() => {
                  const s = selected as StepItem
                  if (s.screenshotUrl)
                    onEditImage(
                      { assetId: s.assetId, itemKey: s.key, scope: "step" },
                      s.screenshotUrl
                    )
                }}
                onPrev={() => selIndex > 0 && goTo(items[selIndex - 1]!.key)}
                onNext={() =>
                  selIndex < items.length - 1 && goTo(items[selIndex + 1]!.key)
                }
              />
            ) : slideSel ? (
              <SlideCanvas
                key={slideSel.key}
                slide={slideSel}
                appearance={previewAppearance ?? slideSel.appearance}
                index={selIndex}
                total={items.length}
                minH={stageH}
                onUpdate={(patch) =>
                  onUpdateItem(slideSel.key, patch as Partial<WalkthroughItemClient>)
                }
                onEditButton={(k) => setEditingButtonKey(k)}
                onAddButton={() => {
                  const b: SlideButton = {
                    key: uid(),
                    text: "Button",
                    destination: { kind: "next" },
                    bgColor: "#5e6ad2",
                    textColor: "#ffffff",
                  }
                  setSlideButtons(slideSel, [...slideSel.buttons, b])
                  setEditingButtonKey(b.key)
                }}
                onPrev={() => selIndex > 0 && goTo(items[selIndex - 1]!.key)}
                onNext={() =>
                  selIndex < items.length - 1 && goTo(items[selIndex + 1]!.key)
                }
              />
            ) : null}
          </div>
        </div>
      )}

      {/* Edit step modal */}
      {isStepSel && (
        <Dialog open={editStepOpen} onOpenChange={setEditStepOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit step</DialogTitle>
            </DialogHeader>
            <div className="flex gap-4">
              <ColorField
                label="Box color"
                value={
                  (selected as StepItem).calloutBg ??
                  customization.brand.color
                }
                onChange={(v) =>
                  onUpdateItem(selected!.key, {
                    calloutBg: v,
                  } as Partial<WalkthroughItemClient>)
                }
              />
              <ColorField
                label="Text color"
                value={(selected as StepItem).calloutText ?? "#ffffff"}
                onChange={(v) =>
                  onUpdateItem(selected!.key, {
                    calloutText: v,
                  } as Partial<WalkthroughItemClient>)
                }
              />
            </div>
            <RichTextEditor
              initialHtml={(selected as StepItem).content}
              onSave={(html) => {
                onEditContent(selected!.key, html)
                setEditStepOpen(false)
              }}
              onCancel={() => setEditStepOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Edit button modal */}
      {slideSel && editingButton && (
        <EditButtonDialog
          button={editingButton}
          destinations={stepDestinations}
          onChange={(next) =>
            setSlideButtons(
              slideSel,
              slideSel.buttons.map((b) => (b.key === next.key ? next : b))
            )
          }
          onDelete={() => {
            setSlideButtons(
              slideSel,
              slideSel.buttons.filter((b) => b.key !== editingButton.key)
            )
            setEditingButtonKey(null)
          }}
          onClose={() => setEditingButtonKey(null)}
        />
      )}
    </div>
  )
}

// ── Toolbar ─────────────────────────────────────────────────────────────────

function ToolbarButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-foreground/80 hover:bg-muted hover:text-foreground inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
    >
      {children}
    </button>
  )
}

// ── Steps panel ───────────────────────────────────────────────────────────

function StepsPanel({
  items,
  selectedKey,
  stepNumber,
  dragKey,
  overKey,
  onSelect,
  onDelete,
  onDragKey,
  onOverKey,
  onDrop,
}: {
  items: WalkthroughItemClient[]
  selectedKey: string | null
  stepNumber: Map<string, number>
  dragKey: string | null
  overKey: string | null
  onSelect: (key: string) => void
  onDelete: (key: string) => void
  onDragKey: (key: string | null) => void
  onOverKey: (key: string | null) => void
  onDrop: (key: string) => void
}) {
  return (
    <div className="relative w-[200px] shrink-0">
      <div className="absolute inset-0 flex flex-col">
        <div className="mb-3 flex shrink-0 items-center justify-between px-1">
          <h3 className="text-foreground text-sm font-semibold">Steps</h3>
          <span className="text-muted-foreground text-xs tabular-nums">
            {items.length}
          </span>
        </div>
        <ol
          className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1 pt-1 pb-1"
          aria-label="Walkthrough steps"
        >
          {items.map((it) => {
            const isStep = it.kind === "step"
            const num = stepNumber.get(it.key)
            const active = selectedKey === it.key
            const thumb = isStep ? (it as StepItem).screenshotUrl : null
            return (
              <li
                key={it.key}
                draggable
                onDragStart={() => onDragKey(it.key)}
                onDragEnd={() => {
                  onDragKey(null)
                  onOverKey(null)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (overKey !== it.key) onOverKey(it.key)
                }}
                onDrop={() => onDrop(it.key)}
                className={cn(
                  "group relative cursor-grab active:cursor-grabbing",
                  dragKey === it.key && "opacity-40"
                )}
              >
                {overKey === it.key && dragKey && dragKey !== it.key && (
                  <div className="bg-cobalt absolute -top-1.5 right-1 left-1 z-20 h-0.5 rounded-full" />
                )}
                <div
                  className={cn(
                    "bg-card relative rounded-2xl border p-2 shadow-sm transition-all",
                    active
                      ? "border-cobalt ring-cobalt/25 ring-2"
                      : "border-border hover:border-cobalt/40"
                  )}
                >
                  <button
                    type="button"
                    aria-label={isStep ? `Step ${num}` : (it as SlideItem).kind}
                    aria-current={active}
                    onClick={() => onSelect(it.key)}
                    className="bg-muted block aspect-[16/10] w-full overflow-hidden rounded-xl"
                  >
                    {isStep && thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt=""
                        draggable={false}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <SlideThumb item={it} />
                    )}
                  </button>

                  <CardMenu onDelete={() => onDelete(it.key)} />

                  <span
                    className={cn(
                      "absolute bottom-4 left-4 flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums shadow-sm",
                      active
                        ? "bg-cobalt text-white"
                        : "bg-background text-cobalt ring-cobalt/40 ring-1"
                    )}
                  >
                    {isStep
                      ? num
                      : (it as SlideItem).kind === "intro"
                        ? "Intro"
                        : "Chapter"}
                  </span>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

function SlideThumb({ item }: { item: WalkthroughItemClient }) {
  const slide = item as SlideItem
  const dark = slide.appearance?.theme === "dark"
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-1.5 px-3",
        dark ? "bg-zinc-900" : "bg-white"
      )}
    >
      <div className={cn("h-2 w-3/5 rounded-full", dark ? "bg-white/70" : "bg-zinc-800/70")} />
      <div className={cn("h-1.5 w-4/5 rounded-full", dark ? "bg-white/25" : "bg-zinc-400/50")} />
    </div>
  )
}

function CardMenu({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Options"
        className="bg-background/95 text-muted-foreground hover:text-foreground absolute top-4 right-4 grid size-7 place-items-center rounded-lg border shadow-sm backdrop-blur transition"
      >
        <MoreHorizontal className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-40 p-1">
        <button
          type="button"
          onClick={() => {
            onDelete()
            setOpen(false)
          }}
          className="text-destructive hover:bg-destructive/10 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors"
        >
          <Trash2 className="size-4" /> Delete
        </button>
      </PopoverContent>
    </Popover>
  )
}

// ── Appearance panel ────────────────────────────────────────────────────────

function AppearancePanel({
  initial,
  kindLabel,
  onPreview,
  onSave,
  onCancel,
}: {
  initial: Appearance
  kindLabel: string
  onPreview: (a: Appearance) => void
  onSave: (a: Appearance) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = React.useState<Appearance>(initial)
  const patch = (p: Partial<Appearance>) => {
    const next = { ...draft, ...p }
    setDraft(next)
    onPreview(next)
  }
  const bgValue =
    draft.background.kind === "preset" ? draft.background.value : null

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex shrink-0 items-center px-1">
        <h3 className="text-foreground text-sm font-semibold">Appearance</h3>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-1 pt-1 pb-1">
        <section>
          <h4 className="text-sm font-semibold">Background</h4>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Choose a preset for this {kindLabel} slide.
          </p>
          <div className="mt-3 grid grid-cols-5 gap-2">
            <SwatchButton
              selected={draft.background.kind === "none"}
              onClick={() => patch({ background: { kind: "none", value: null } })}
              title="None"
            >
              <X className="text-muted-foreground size-4" />
            </SwatchButton>
            {BG_PRESETS.map((bg) => (
              <SwatchButton
                key={bg}
                selected={bgValue === bg}
                onClick={() =>
                  patch({ background: { kind: "preset", value: bg } })
                }
                style={{ background: bg }}
                title="Preset background"
              />
            ))}
          </div>
        </section>

        <section>
          <h4 className="text-sm font-semibold">Theme</h4>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Light or dark styling for this slide.
          </p>
          <BigSegmented
            className="mt-3"
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
            value={draft.theme}
            onChange={(v) => patch({ theme: v as "light" | "dark" })}
          />
        </section>

        <section>
          <h4 className="text-sm font-semibold">Content alignment</h4>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Align title and body within the slide.
          </p>
          <BigSegmented
            className="mt-3"
            options={[
              { value: "left", label: <AlignLeft className="mx-auto size-4" /> },
              {
                value: "center",
                label: <AlignCenter className="mx-auto size-4" />,
              },
              {
                value: "right",
                label: <AlignRight className="mx-auto size-4" />,
              },
            ]}
            value={draft.align}
            onChange={(v) =>
              patch({ align: v as "left" | "center" | "right" })
            }
          />
        </section>

        <section>
          <h4 className="text-sm font-semibold">Button columns</h4>
          <p className="text-muted-foreground mt-0.5 text-xs">
            How many columns to use for buttons.
          </p>
          <BigSegmented
            className="mt-3"
            options={[
              { value: "1", label: "1" },
              { value: "2", label: "2" },
              { value: "3", label: "3" },
            ]}
            value={String(draft.buttonColumns)}
            onChange={(v) =>
              patch({ buttonColumns: Number(v) as 1 | 2 | 3 })
            }
          />
        </section>
      </div>

      <div className="mt-5 flex gap-3 border-t pt-4">
        <button
          type="button"
          onClick={() => onSave(draft)}
          className="bg-cobalt flex-1 rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border-cobalt text-cobalt hover:bg-cobalt/5 flex-1 rounded-lg border py-2.5 text-sm font-semibold transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function SwatchButton({
  selected,
  onClick,
  style,
  title,
  children,
}: {
  selected: boolean
  onClick: () => void
  style?: React.CSSProperties
  title: string
  children?: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={style}
      className={cn(
        "grid aspect-square place-items-center rounded-lg border transition-all",
        selected
          ? "border-cobalt ring-cobalt/30 ring-2"
          : "border-border hover:border-cobalt/40"
      )}
    >
      {children}
    </button>
  )
}

function BigSegmented({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: string; label: React.ReactNode }[]
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        "grid overflow-hidden rounded-lg border",
        className,
        options.length === 2 && "grid-cols-2",
        options.length === 3 && "grid-cols-3"
      )}
    >
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "py-2.5 text-sm font-semibold transition-colors",
            i > 0 && "border-l",
            value === o.value
              ? "bg-cobalt text-white"
              : "text-foreground/80 hover:bg-muted"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── Step canvas ─────────────────────────────────────────────────────────────

function StepCanvas({
  step,
  hotspot,
  index,
  total,
  onEdit,
  onEditImage,
  onPrev,
  onNext,
}: {
  step: StepItem
  hotspot: GuideCustomization["general"]["hotspot"]
  index: number
  total: number
  onEdit: () => void
  onEditImage: () => void
  onPrev: () => void
  onNext: () => void
}) {
  const atStart = index === 0
  const atEnd = index === total - 1
  const rect = step.screenshotUrl ? step.clickRect : null
  const cx = rect ? (rect.x + rect.w / 2) * 100 : 50
  const cy = rect ? (rect.y + rect.h / 2) * 100 : 50
  const onRight = cx <= 50

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="relative">
        <NavChevron side="left" disabled={atStart} onClick={onPrev} />
        <NavChevron side="right" disabled={atEnd} onClick={onNext} />

        <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
          <ChromeBar />
          {step.screenshotUrl ? (
            <div className="group/shot relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={step.screenshotUrl} alt="" className="block w-full" />

              <button
                type="button"
                onClick={onEditImage}
                aria-label="Edit image"
                title="Edit image"
                className="bg-background/95 text-foreground absolute top-3 right-3 z-20 grid size-8 place-items-center rounded-lg border opacity-0 shadow-sm backdrop-blur transition group-hover/shot:opacity-100 hover:scale-105"
              >
                <Pencil className="size-4" />
              </button>

              {rect && hotspot.type === "highlight-box" ? (
                <div
                  className="ring-primary pointer-events-none absolute z-10 rounded-md ring-2"
                  style={{
                    left: `${Math.max(0, (rect.x - 0.008 * hotspot.size) * 100)}%`,
                    top: `${Math.max(0, (rect.y - 0.008 * hotspot.size) * 100)}%`,
                    width: `${(rect.w + 0.016 * hotspot.size) * 100}%`,
                    height: `${(rect.h + 0.016 * hotspot.size) * 100}%`,
                    boxShadow:
                      "0 0 0 4px color-mix(in srgb, var(--primary) 22%, transparent)",
                  }}
                />
              ) : rect ? (
                <div
                  className="text-primary pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${cx}%`, top: `${cy}%` }}
                >
                  <span className="block" style={{ transform: `scale(${hotspot.size})` }}>
                    <HotspotGlyph type={hotspot.type} />
                  </span>
                </div>
              ) : null}

              <EditorCallout
                cx={cx}
                cy={cy}
                onRight={onRight}
                html={step.content}
                bg={step.calloutBg}
                textColor={step.calloutText}
                index={index}
                total={total}
                atStart={atStart}
                atEnd={atEnd}
                onEdit={onEdit}
                onPrev={onPrev}
                onNext={onNext}
              />
            </div>
          ) : (
            <div className="text-muted-foreground flex min-h-[280px] items-center justify-center p-10 text-center text-sm">
              No screenshot for this step.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Slide canvas ────────────────────────────────────────────────────────────

function SlideCanvas({
  slide,
  appearance,
  index,
  total,
  onUpdate,
  onEditButton,
  onAddButton,
  onPrev,
  onNext,
  minH,
}: {
  slide: SlideItem
  appearance: Appearance
  index: number
  total: number
  onUpdate: (patch: Partial<SlideItem>) => void
  onEditButton: (key: string) => void
  onAddButton: () => void
  onPrev: () => void
  onNext: () => void
  /** Match the step screenshot height so every frame is the same size. */
  minH?: number
}) {
  const dark = appearance.theme === "dark"
  const bg =
    appearance.background.kind === "preset" ? appearance.background.value : null
  const alignClass =
    appearance.align === "left"
      ? "items-start text-left"
      : appearance.align === "right"
        ? "items-end text-right"
        : "items-center text-center"
  // The title/subtitle are full-width textareas, so their internal text-align
  // must follow the chosen alignment too (not just the flex `items-*`).
  const textAlign =
    appearance.align === "left"
      ? "text-left"
      : appearance.align === "right"
        ? "text-right"
        : "text-center"
  const colClass =
    appearance.buttonColumns === 3
      ? "grid-cols-3"
      : appearance.buttonColumns === 2
        ? "grid-cols-2"
        : "grid-cols-1"

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="relative">
        <NavChevron side="left" disabled={index === 0} onClick={onPrev} />
        <NavChevron side="right" disabled={index === total - 1} onClick={onNext} />

        <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
          <ChromeBar />
          <div
            className={cn(
              "flex flex-col justify-center gap-4 px-12 py-16 transition-colors",
              alignClass,
              minH == null && "min-h-[440px]",
              !bg && (dark ? "bg-zinc-900" : "bg-white")
            )}
            style={{ minHeight: minH, ...(bg ? { background: bg } : {}) }}
          >
          <AutoTextarea
            value={slide.title}
            onCommit={(title) => onUpdate({ title })}
            placeholder="Slide title"
            className={cn(
              "w-full resize-none bg-transparent font-serif text-4xl leading-tight font-semibold tracking-tight outline-none",
              textAlign,
              dark ? "text-white placeholder:text-white/30" : "text-zinc-900 placeholder:text-zinc-300"
            )}
          />
          <AutoTextarea
            value={slide.subtitle}
            onCommit={(subtitle) => onUpdate({ subtitle })}
            placeholder="Add a subtitle (optional)"
            className={cn(
              "w-full resize-none bg-transparent text-lg leading-relaxed outline-none",
              textAlign,
              dark ? "text-white/70 placeholder:text-white/25" : "text-zinc-500 placeholder:text-zinc-300"
            )}
          />

          <div className={cn("mt-4 grid w-full max-w-md gap-2.5", colClass)}>
            {slide.buttons.map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() => onEditButton(b.key)}
                style={{ backgroundColor: b.bgColor, color: b.textColor }}
                className="rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition-transform hover:brightness-105 active:scale-[0.98]"
              >
                {b.text || "Button"}
              </button>
            ))}
            <button
              type="button"
              onClick={onAddButton}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg border border-dashed py-2.5 text-sm font-medium transition-colors",
                dark
                  ? "border-white/25 text-white/60 hover:bg-white/5"
                  : "border-zinc-300 text-zinc-400 hover:bg-zinc-50"
              )}
            >
              <Plus className="size-4" /> Add button
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Edit button dialog ──────────────────────────────────────────────────────

function EditButtonDialog({
  button,
  destinations,
  onChange,
  onDelete,
  onClose,
}: {
  button: SlideButton
  destinations: { stepKey: string; label: string }[]
  onChange: (b: SlideButton) => void
  onDelete: () => void
  onClose: () => void
}) {
  const destValue =
    button.destination.kind === "step"
      ? button.destination.stepKey
      : button.destination.kind
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit button</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Text">
            <Input
              value={button.text}
              onChange={(e) => onChange({ ...button, text: e.target.value })}
            />
          </Field>
          <Field label="Destination">
            <DestinationSelect
              value={destValue}
              options={[
                { value: "next", label: "Next step" },
                { value: "prev", label: "Previous step" },
                ...destinations.map((d) => ({
                  value: d.stepKey,
                  label: d.label,
                })),
              ]}
              onChange={(v) =>
                onChange({
                  ...button,
                  destination:
                    v === "next"
                      ? { kind: "next" }
                      : v === "prev"
                        ? { kind: "prev" }
                        : { kind: "step", stepKey: v },
                })
              }
            />
          </Field>
          <div className="flex gap-4">
            <ColorField
              label="Background color"
              value={button.bgColor}
              onChange={(v) => onChange({ ...button, bgColor: v })}
            />
            <ColorField
              label="Text color"
              value={button.textColor}
              onChange={(v) => onChange({ ...button, textColor: v })}
            />
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete button"
              className="text-destructive bg-destructive/10 hover:bg-destructive/20 grid size-10 place-items-center rounded-lg transition-colors"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block flex-1 space-y-1.5">
      <span className="text-foreground text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-10 shrink-0 cursor-pointer rounded-md border bg-transparent"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono"
        />
      </div>
    </Field>
  )
}

/** Shadcn-style dropdown (base-ui DropdownMenu) for the button destination. */
function DestinationSelect({
  value,
  options,
  onChange,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  const current = options.find((o) => o.value === value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" className="w-full justify-between font-normal" />
        }
      >
        <span className="truncate">{current?.label ?? "Select…"}</span>
        <ChevronDown className="size-4 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-72 w-[--anchor-width] overflow-y-auto"
      >
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onClick={() => onChange(o.value)}>
            <span className="flex-1 truncate">{o.label}</span>
            {o.value === value && <Check className="text-primary size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Shared bits ─────────────────────────────────────────────────────────────

function AutoTextarea({
  value,
  onCommit,
  placeholder,
  className,
}: {
  value: string
  onCommit: (v: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <textarea
      defaultValue={value}
      key={value}
      rows={1}
      placeholder={placeholder}
      onBlur={(e) => {
        if (e.target.value !== value) onCommit(e.target.value)
      }}
      className={cn("[field-sizing:content]", className)}
    />
  )
}

function ChromeBar() {
  return (
    <div className="bg-muted/40 flex items-center gap-1.5 border-b px-4 py-2.5">
      <span className="size-2.5 rounded-full bg-red-400/70" />
      <span className="size-2.5 rounded-full bg-yellow-400/70" />
      <span className="size-2.5 rounded-full bg-green-400/70" />
    </div>
  )
}

function EditorCallout({
  cx,
  cy,
  onRight,
  html,
  bg,
  textColor,
  index,
  total,
  atStart,
  atEnd,
  onEdit,
  onPrev,
  onNext,
}: {
  cx: number
  cy: number
  onRight: boolean
  html: string
  bg: string | null
  textColor: string | null
  index: number
  total: number
  atStart: boolean
  atEnd: boolean
  onEdit: () => void
  onPrev: () => void
  onNext: () => void
}) {
  const GAP = 34
  return (
    <div
      className={cn(
        "group/callout absolute z-20 w-[248px] max-w-[70%] rounded-xl p-3 shadow-[0_16px_40px_-12px_color-mix(in_srgb,var(--primary)_70%,transparent)] ring-1 ring-white/10",
        !bg && "bg-primary",
        !textColor && "text-primary-foreground"
      )}
      style={{
        left: `${cx}%`,
        top: `${cy}%`,
        transform: onRight
          ? `translateY(-50%) translateX(${GAP}px)`
          : `translateY(-50%) translateX(calc(-100% - ${GAP}px))`,
        ...(bg ? { backgroundColor: bg } : {}),
        ...(textColor ? { color: textColor } : {}),
      }}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 size-3 -translate-y-1/2 rotate-45",
          !bg && "bg-primary",
          onRight ? "-left-1" : "-right-1"
        )}
        style={bg ? { backgroundColor: bg } : undefined}
      />
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit instruction"
        className="-mx-1.5 -mt-1.5 flex w-[calc(100%+0.75rem)] items-start gap-1.5 rounded-lg px-1.5 pt-1.5 text-left transition-colors hover:bg-white/10"
      >
        <RichText
          html={html}
          className="min-w-0 flex-1 text-sm leading-snug font-semibold [overflow-wrap:anywhere]"
        />
        <Pencil className="mt-0.5 size-3.5 shrink-0 opacity-0 transition-opacity group-hover/callout:opacity-80" />
      </button>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-primary-foreground/70 font-mono text-[11px] tabular-nums">
          {index + 1} / {total}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onPrev}
            disabled={atStart}
            aria-label="Previous step"
            className="flex size-6 items-center justify-center rounded-md bg-white/15 transition hover:bg-white/25 active:scale-90 disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={onNext}
            disabled={atEnd}
            aria-label="Next step"
            className="text-primary flex size-6 items-center justify-center rounded-md bg-white shadow-sm transition hover:bg-white/90 active:scale-90 disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function NavChevron({
  side,
  disabled,
  onClick,
}: {
  side: "left" | "right"
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous step" : "Next step"}
      className={cn(
        "text-cobalt/70 hover:text-cobalt hover:bg-cobalt/10 absolute top-1/2 z-20 hidden -translate-y-1/2 place-items-center rounded-full p-1 transition disabled:pointer-events-none disabled:opacity-0 lg:grid",
        side === "left" ? "-left-9" : "-right-9"
      )}
    >
      {side === "left" ? (
        <ChevronLeft className="size-7" strokeWidth={2.5} />
      ) : (
        <ChevronRight className="size-7" strokeWidth={2.5} />
      )}
    </button>
  )
}
