"use client"

import * as React from "react"
import {
  ArrowRight,
  Check,
  FileText,
  Link2,
  Play,
  Video,
  X,
} from "lucide-react"

import type { PublicShowcase, ShowcaseItemPayload } from "@workspace/contracts/showcase"
import { LogoMark } from "@workspace/ui/components/logo"
import { cn } from "@workspace/ui/lib/utils"

import { ShowcaseItemView } from "@/components/showcase/view/item-renderer"

const ITEM_ICON: Record<ShowcaseItemPayload["type"], React.ComponentType<{ className?: string }>> = {
  guide: FileText,
  video: Video,
  pdf: FileText,
  link: Link2,
  form: FileText,
}

/** Black or white text for the brand color (WCAG luminance). */
function readableForeground(hex?: string | null): string {
  const m = hex ? /^#?([0-9a-f]{6})$/i.exec(hex.trim()) : null
  if (!m || !m[1]) return "#ffffff"
  const n = parseInt(m[1], 16)
  const c = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const L = 0.2126 * c((n >> 16) & 255) + 0.7152 * c((n >> 8) & 255) + 0.0722 * c(n & 255)
  return L > 0.5 ? "#141416" : "#ffffff"
}

export function ShowcaseView({ showcase, embedded = false }: { showcase: PublicShowcase; embedded?: boolean }) {
  // Standalone showcase is light-only (like the guide reader); the embed variant
  // controls theme via its layout. Skip when embedded (theme already applied).
  React.useEffect(() => {
    if (embedded) return
    const el = document.documentElement
    const wasDark = el.classList.contains("dark")
    el.classList.remove("dark")
    return () => {
      if (wasDark) el.classList.add("dark")
    }
  }, [embedded])

  const flat = React.useMemo(() => showcase.sections.flatMap((s) => s.items), [showcase.sections])
  const [activeId, setActiveId] = React.useState<string | null>(flat[0]?.id ?? null)
  const [completed, setCompleted] = React.useState<Set<string>>(new Set())

  const active = flat.find((i) => i.id === activeId) ?? flat[0] ?? null
  const activeIndex = active ? flat.findIndex((i) => i.id === active.id) : -1

  const markComplete = React.useCallback(
    (id: string) => setCompleted((prev) => (prev.has(id) ? prev : new Set(prev).add(id))),
    []
  )
  const advance = React.useCallback(() => {
    const next = flat[activeIndex + 1]
    if (next) setActiveId(next.id)
  }, [flat, activeIndex])

  const onItemComplete = React.useCallback(() => {
    if (active) markComplete(active.id)
    if (showcase.autoplay) advance()
  }, [active, markComplete, advance, showcase.autoplay])

  const style = {
    backgroundColor: "#FEFFFF",
    ...(showcase.brandColor
      ? {
          ["--primary" as string]: showcase.brandColor,
          ["--primary-foreground" as string]: readableForeground(showcase.brandColor),
        }
      : {}),
  } as React.CSSProperties

  return (
    <div className="flex min-h-svh flex-col text-[var(--l-ink)]" style={style}>
      {!embedded && (
        <header className="sticky top-0 z-30 bg-primary text-primary-foreground">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-2.5 px-4 sm:px-6">
            {showcase.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={showcase.logoUrl} alt="" className="h-7 w-auto max-w-[120px] object-contain" />
            ) : (
              <span className="flex size-8 items-center justify-center rounded-lg bg-white/15">
                <LogoMark className="size-5" />
              </span>
            )}
            <span className="truncate text-[15px] font-semibold">{showcase.title}</span>
          </div>
        </header>
      )}

      <div className="flex-1">
        {flat.length === 0 ? (
          <div className="mx-auto max-w-md px-6 py-24 text-center text-sm text-[var(--l-ink-subtle)]">
            Nothing published here yet.
          </div>
        ) : showcase.layout === "GALLERY" ? (
          <GalleryLayout showcase={showcase} activeId={activeId} setActiveId={setActiveId} completed={completed} onItemComplete={onItemComplete} />
        ) : (
          <SplitLayout
            showcase={showcase}
            active={active}
            setActiveId={setActiveId}
            completed={completed}
            checklist={showcase.layout === "CHECKLIST"}
            onItemComplete={onItemComplete}
            onNext={advance}
            hasNext={activeIndex >= 0 && activeIndex < flat.length - 1}
          />
        )}
      </div>

      {!embedded && (
        <footer className="border-t border-[var(--l-hairline)]">
          <div className="mx-auto flex max-w-6xl items-center justify-center px-6 py-6">
            <a href="/" className="inline-flex items-center gap-2 font-mono text-xs text-[var(--l-ink-subtle)] hover:text-[var(--l-ink)]">
              <LogoMark className="size-4" /> Made with Tacto
            </a>
          </div>
        </footer>
      )}
    </div>
  )
}

/* ── Section + Checklist share a sidebar + reading pane ───────────────────── */
function SplitLayout({
  showcase,
  active,
  setActiveId,
  completed,
  checklist,
  onItemComplete,
  onNext,
  hasNext,
}: {
  showcase: PublicShowcase
  active: ShowcaseItemPayload | null
  setActiveId: (id: string) => void
  completed: Set<string>
  checklist: boolean
  onItemComplete: () => void
  onNext: () => void
  hasNext: boolean
}) {
  const total = showcase.sections.reduce((n, s) => n + s.items.length, 0)
  const done = completed.size

  return (
    <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6 sm:px-6">
      <aside className="hidden w-72 flex-none lg:block">
        <div className="sticky top-20">
          {checklist && (
            <div className="mb-4">
              <div className="mb-1.5 flex items-center justify-between text-[12px] font-medium text-[var(--l-ink-subtle)]">
                <span>Progress</span>
                <span>
                  {done} / {total}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--l-chrome)]">
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
              </div>
            </div>
          )}
          <nav className="flex flex-col gap-4">
            {showcase.sections.map((section) => (
              <div key={section.id}>
                <p className="mb-1 px-2 text-[11px] font-semibold tracking-wide text-[var(--l-ink-tertiary)] uppercase">
                  {section.title}
                </p>
                {section.items.map((item) => {
                  const Icon = ITEM_ICON[item.type]
                  const isActive = active?.id === item.id
                  const isDone = completed.has(item.id)
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveId(item.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13px] transition-colors",
                        isActive ? "bg-primary/10 font-medium text-primary" : "text-[var(--l-ink)] hover:bg-[var(--l-hover)]"
                      )}
                    >
                      {checklist ? (
                        <span
                          className={cn(
                            "flex size-4 flex-none items-center justify-center rounded-full border",
                            isDone ? "border-primary bg-primary text-primary-foreground" : "border-[var(--l-hairline-strong)]"
                          )}
                        >
                          {isDone && <Check className="size-3" strokeWidth={3} />}
                        </span>
                      ) : (
                        <Icon className="size-4 flex-none text-[var(--l-ink-tertiary)]" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </nav>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        {active && <ShowcaseItemView key={active.id} item={active} slug={showcase.slug} onComplete={onItemComplete} />}
        {checklist && hasNext && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={onNext}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Next <ArrowRight className="size-4" />
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

/* ── Gallery: thumbnail grid → modal reader ──────────────────────────────── */
function GalleryLayout({
  showcase,
  activeId,
  setActiveId,
  completed,
  onItemComplete,
}: {
  showcase: PublicShowcase
  activeId: string | null
  setActiveId: (id: string | null) => void
  completed: Set<string>
  onItemComplete: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const active = showcase.sections.flatMap((s) => s.items).find((i) => i.id === activeId)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {showcase.sections.map((section) => (
        <section key={section.id} className="mb-10">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">{section.title}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.items.map((item) => {
              const Icon = ITEM_ICON[item.type]
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveId(item.id)
                    setOpen(true)
                  }}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-card)] text-left transition-colors hover:border-primary/40"
                >
                  <div className="flex aspect-video items-center justify-center bg-[var(--l-chrome)] text-[var(--l-ink-tertiary)]">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      {item.type === "video" ? <Play className="size-5" /> : <Icon className="size-5" />}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-4">
                    {completed.has(item.id) && <Check className="size-4 flex-none text-primary" />}
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{item.title}</span>
                    <span className="text-[10px] font-medium text-[var(--l-ink-tertiary)] uppercase">{item.type}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      ))}

      {open && active && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[6vh]" role="dialog" aria-modal="true">
          <div className="relative w-full max-w-3xl rounded-2xl bg-[#FEFFFF] p-4 shadow-2xl sm:p-6">
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-lg bg-black/10 text-[var(--l-ink)] hover:bg-black/20"
            >
              <X className="size-4" />
            </button>
            <ShowcaseItemView key={active.id} item={active} slug={showcase.slug} onComplete={onItemComplete} />
          </div>
        </div>
      )}
    </div>
  )
}
