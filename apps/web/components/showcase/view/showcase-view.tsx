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

import { PublicThemeToggle } from "@/components/public-theme-toggle"
import { ChecklistBadge } from "@/components/showcase/view/checklist-badge"
import { ShowcaseItemView } from "@/components/showcase/view/item-renderer"
import { useShowcaseTracker } from "@/lib/showcase-tracker"

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
  // Theme: the standalone viewer's light/dark is owned by PublicThemeProvider
  // (from the route layout) + the header toggle; the embed variant applies its
  // own `?theme=` via EmbedTheme. Nothing to force here.
  const tracker = useShowcaseTracker(showcase.slug)

  const flat = React.useMemo(() => showcase.sections.flatMap((s) => s.items), [showcase.sections])
  const total = flat.length
  const [activeId, setActiveId] = React.useState<string | null>(flat[0]?.id ?? null)
  const [completed, setCompleted] = React.useState<Set<string>>(new Set())

  const active = flat.find((i) => i.id === activeId) ?? flat[0] ?? null
  const activeIndex = active ? flat.findIndex((i) => i.id === active.id) : -1

  // Fire `view` once, and `item_open` whenever the active item changes (the
  // tracker dedups both per visit).
  React.useEffect(() => {
    tracker.track("view")
  }, [tracker])
  React.useEffect(() => {
    if (active) tracker.track("item_open", active.id)
  }, [active?.id, tracker]) // eslint-disable-line react-hooks/exhaustive-deps

  // `complete` fires once when every item is checked off.
  React.useEffect(() => {
    if (total > 0 && completed.size >= total) tracker.track("complete")
  }, [completed, total, tracker])

  const markComplete = React.useCallback(
    (id: string) => setCompleted((prev) => (prev.has(id) ? prev : new Set(prev).add(id))),
    []
  )
  const advance = React.useCallback(() => {
    const next = flat[activeIndex + 1]
    if (next) setActiveId(next.id)
  }, [flat, activeIndex])

  const onItemComplete = React.useCallback(() => {
    if (active) {
      markComplete(active.id)
      tracker.track("item_complete", active.id)
    }
    if (showcase.autoplay) advance()
  }, [active, markComplete, advance, showcase.autoplay, tracker])

  const style = showcase.brandColor
    ? ({
        ["--primary" as string]: showcase.brandColor,
        ["--primary-foreground" as string]: readableForeground(showcase.brandColor),
      } as React.CSSProperties)
    : undefined

  return (
    <div className="flex min-h-svh flex-col bg-white text-[var(--l-ink)] dark:bg-[var(--l-canvas)]" style={style}>
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
            <PublicThemeToggle className="ml-auto" />
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

      {showcase.layout === "CHECKLIST" && (
        <ChecklistBadge done={completed.size} total={total} className={embedded ? undefined : "lg:hidden"} />
      )}

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
                      aria-current={isActive ? "true" : undefined}
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
        {/* Mobile item nav — the sidebar is desktop-only, so small screens get a
            horizontal scroller (same convention as the guide reader). */}
        <MobileItemBar
          showcase={showcase}
          activeId={active?.id ?? null}
          setActiveId={setActiveId}
          completed={completed}
          checklist={checklist}
          total={total}
          done={done}
        />
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

/* ── Mobile item nav (< lg): horizontal chip scroller ─────────────────────── */
function MobileItemBar({
  showcase,
  activeId,
  setActiveId,
  completed,
  checklist,
  total,
  done,
}: {
  showcase: PublicShowcase
  activeId: string | null
  setActiveId: (id: string) => void
  completed: Set<string>
  checklist: boolean
  total: number
  done: number
}) {
  const items = showcase.sections.flatMap((s) => s.items)
  if (items.length <= 1) return null
  return (
    <div className="mb-5 lg:hidden">
      {checklist && (
        <div className="mb-2">
          <div className="mb-1.5 flex items-center justify-between text-[12px] font-medium text-[var(--l-ink-subtle)]">
            <span>Progress</span>
            <span className="tabular-nums">
              {done} / {total}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--l-chrome)]">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
        </div>
      )}
      <nav aria-label="Showcase items" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
        {items.map((item) => {
          const Icon = ITEM_ICON[item.type]
          const isActive = activeId === item.id
          const isDone = completed.has(item.id)
          return (
            <button
              key={item.id}
              onClick={() => setActiveId(item.id)}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "flex flex-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors",
                isActive
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-[var(--l-hairline)] text-[var(--l-ink)] hover:bg-[var(--l-hover)]"
              )}
            >
              {checklist && isDone ? (
                <Check className="size-3.5 flex-none text-primary" strokeWidth={3} />
              ) : (
                <Icon className="size-3.5 flex-none text-[var(--l-ink-tertiary)]" />
              )}
              <span className="max-w-[10rem] truncate">{item.title}</span>
            </button>
          )
        })}
      </nav>
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
  const closeRef = React.useRef<HTMLButtonElement>(null)

  // Modal a11y: Esc to close, focus the close button, lock body scroll.
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    closeRef.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

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
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[6vh]"
          role="dialog"
          aria-modal="true"
          aria-label={active.title}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div className="relative w-full max-w-3xl rounded-2xl bg-white p-4 shadow-2xl sm:p-6 dark:bg-[var(--l-card)]">
            <button
              ref={closeRef}
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
