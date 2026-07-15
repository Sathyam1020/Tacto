"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import {
  BookOpen,
  Check,
  Eye,
  FileText,
  GripVertical,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import type { HelpArticleCard, HelpCollectionDetail } from "@workspace/contracts/help-center"
import { Button } from "@workspace/ui/components/button"
import { LogoMark } from "@workspace/ui/components/logo"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

import { CollectionIconPicker } from "@/components/help-center/collection-icon"
import { useSetNavbar } from "@/components/navbar-context"
import {
  useAddArticles,
  useAvailableGuides,
  useFeatureArticle,
  useHelpCenter,
  usePublishHelpCenter,
  useRemoveArticle,
  useReorderArticles,
  useUpdateCollection,
  useUpdateHelpCenter,
} from "@/lib/help-center"

export default function HelpCenterBuilderPage() {
  const params = useSearchParams()
  const tab = params.get("tab")
  const c = params.get("c")
  const { data: hc } = useHelpCenter()
  const publish = usePublishHelpCenter()

  const published = hc?.status === "PUBLISHED"
  const title =
    tab === "design"
      ? "Design"
      : tab === "settings"
        ? "Settings"
        : c
          ? (hc?.collections.find((x) => x.id === c)?.name ?? "Collection")
          : "All articles"

  useSetNavbar(
    {
      leftActions: (
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-[15px] font-semibold">{title}</h1>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
              published
                ? "bg-[var(--l-success)]/10 text-[var(--l-success)] ring-[var(--l-success-ring)]"
                : "bg-[var(--l-chrome)] text-muted-foreground ring-[var(--l-hairline)]"
            )}
          >
            {published && <span className="size-1.5 rounded-full bg-[var(--l-success)]" />}
            {published ? "Live" : "Draft"}
          </span>
        </div>
      ),
      actions: (
        <div className="flex items-center gap-2">
          {hc?.slug && (
            <Button
              variant="outline"
              size="sm"
              render={<a href={`/help/${hc.slug}`} target="_blank" rel="noreferrer" />}
            >
              <Eye className="size-4" />
              View
            </Button>
          )}
          {!published && (
            <Button
              size="sm"
              disabled={publish.isPending}
              onClick={() =>
                publish.mutate(undefined, {
                  onSuccess: () => toast.success("Help center published"),
                  onError: () => toast.error("Couldn't publish"),
                })
              }
            >
              Publish
            </Button>
          )}
        </div>
      ),
    },
    [title, published, hc?.slug, publish.isPending]
  )

  if (!hc) return <BuilderSkeleton />

  return (
    <div className="mx-auto max-w-4xl">
      {tab === "design" ? (
        <DesignSurface hc={hc} />
      ) : tab === "settings" ? (
        <SettingsSurface hc={hc} />
      ) : (
        <ContentSurface hc={hc} onlyCollection={c} />
      )}
    </div>
  )
}

/* ── Content ─────────────────────────────────────────────────────────────── */
function ContentSurface({
  hc,
  onlyCollection,
}: {
  hc: NonNullable<ReturnType<typeof useHelpCenter>["data"]>
  onlyCollection: string | null
}) {
  const collections = onlyCollection
    ? hc.collections.filter((c) => c.id === onlyCollection)
    : hc.collections

  if (hc.collections.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen className="size-6" />}
        title="Create your first collection"
        body="Collections group your published guides into categories — like Getting Started or Billing. Add one from the sidebar."
      />
    )
  }

  return (
    <div className="flex flex-col gap-8 py-1">
      {collections.map((col) => (
        <CollectionSection key={col.id} col={col} />
      ))}
    </div>
  )
}

function CollectionSection({ col }: { col: HelpCollectionDetail }) {
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const reorder = useReorderArticles()
  const remove = useRemoveArticle()
  const feature = useFeatureArticle()
  const updateCollection = useUpdateCollection()

  // Local order for snappy drag; re-synced whenever the server order changes.
  const [order, setOrder] = React.useState<HelpArticleCard[]>(col.articles)
  React.useEffect(() => setOrder(col.articles), [col.articles])
  const dragId = React.useRef<string | null>(null)

  function onDrop(overId: string) {
    const from = order.findIndex((a) => a.id === dragId.current)
    const to = order.findIndex((a) => a.id === overId)
    dragId.current = null
    if (from < 0 || to < 0 || from === to) return
    const next = order.slice()
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved!)
    setOrder(next)
    reorder.mutate(next.map((a) => a.id))
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <CollectionIconPicker
            value={col.icon}
            onSelect={(icon) => updateCollection.mutate({ id: col.id, icon })}
          />
          <h2 className="text-[17px] font-semibold tracking-tight">{col.name}</h2>
          <span className="ml-1 text-[13px] text-muted-foreground">
            {col.articles.length} {col.articles.length === 1 ? "article" : "articles"}
          </span>
        </div>
        <Button size="sm" onClick={() => setPickerOpen(true)}>
          <Plus className="size-4" />
          Add articles
        </Button>
      </div>

      {order.length === 0 ? (
        <button
          onClick={() => setPickerOpen(true)}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--l-hairline-strong)] bg-[var(--l-card)] px-6 py-12 text-center transition-colors hover:border-primary"
        >
          <FileText className="size-6 text-muted-foreground" />
          <span className="text-sm font-semibold">No articles yet</span>
          <span className="text-[13px] text-muted-foreground">Add published guides to this collection.</span>
        </button>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {order.map((a) => (
            <ArticleCard
              key={a.id}
              article={a}
              onDragStart={() => (dragId.current = a.id)}
              onDrop={() => onDrop(a.id)}
              onFeature={() => feature.mutate({ id: a.id, featured: !a.featured })}
              onRemove={() =>
                remove.mutate(a.id, { onSuccess: () => toast.success("Removed from collection") })
              }
            />
          ))}
        </div>
      )}

      {pickerOpen && (
        <AddGuidesPicker
          collectionId={col.id}
          already={new Set(col.articles.map((a) => a.guideId))}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </section>
  )
}

function ArticleCard({
  article,
  onDragStart,
  onDrop,
  onFeature,
  onRemove,
}: {
  article: HelpArticleCard
  onDragStart: () => void
  onDrop: () => void
  onFeature: () => void
  onRemove: () => void
}) {
  const [over, setOver] = React.useState(false)
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={() => {
        setOver(false)
        onDrop()
      }}
      className={cn(
        "group relative flex flex-col rounded-2xl border bg-[var(--l-card)] p-4 shadow-[inset_0_1px_0_var(--l-edge)] transition-[border-color,box-shadow]",
        over ? "border-primary ring-2 ring-primary/30" : "border-[var(--l-hairline)] hover:border-[var(--l-hairline-strong)]"
      )}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 cursor-grab text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing">
          <GripVertical className="size-4" />
        </span>
        <span className="flex size-9 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileText className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug">{article.title}</h3>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 pl-6">
        <Chip>{article.readMinutes} min read</Chip>
        {article.status === "PUBLISHED" ? (
          <Chip tone="ok">Published</Chip>
        ) : (
          <Chip tone="warn">Unpublished</Chip>
        )}
        {article.featured && <Chip tone="feat">★ Featured</Chip>}
      </div>

      {/* actions */}
      <div className="absolute top-3 right-3 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Feature"
                onClick={onFeature}
                className={cn(article.featured && "text-amber-500")}
              />
            }
          >
            <Star className={cn("size-4", article.featured && "fill-current")} />
          </TooltipTrigger>
          <TooltipContent side="bottom">{article.featured ? "Unfeature" : "Feature on homepage"}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button size="icon-sm" variant="ghost" aria-label="Remove" onClick={onRemove} className="hover:text-rose-500" />
            }
          >
            <Trash2 className="size-4" />
          </TooltipTrigger>
          <TooltipContent side="bottom">Remove from collection</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "ok" | "warn" | "feat" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        tone === "ok"
          ? "bg-[var(--l-success)]/10 text-[var(--l-success)] ring-[var(--l-success-ring)]"
          : tone === "warn"
            ? "bg-amber-500/10 text-amber-600 ring-amber-500/25"
            : tone === "feat"
              ? "bg-primary/10 text-primary ring-primary/25"
              : "bg-[var(--l-lift)] text-[var(--l-ink-subtle)] ring-[var(--l-hairline)]"
      )}
    >
      {children}
    </span>
  )
}

/* ── Add guides picker ───────────────────────────────────────────────────── */
function AddGuidesPicker({
  collectionId,
  already,
  onClose,
}: {
  collectionId: string
  already: Set<string>
  onClose: () => void
}) {
  const [q, setQ] = React.useState("")
  const [picked, setPicked] = React.useState<Set<string>>(new Set())
  const { data: guides } = useAvailableGuides(q, true)
  const add = useAddArticles()

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  function submit() {
    if (picked.size === 0) return
    add.mutate(
      { collectionId, guideIds: [...picked] },
      {
        onSuccess: () => {
          toast.success(`Added ${picked.size} ${picked.size === 1 ? "article" : "articles"}`)
          onClose()
        },
        onError: () => toast.error("Couldn't add articles"),
      }
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={onClose} />
      <div className="relative flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-card)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-[var(--l-hairline)] px-4 py-3">
          <h3 className="text-sm font-semibold">Add published guides</h3>
          <button onClick={onClose} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-2.5 border-b border-[var(--l-hairline)] px-4">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your published guides…"
            className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {(guides ?? []).map((g) => {
            const added = already.has(g.id)
            const on = picked.has(g.id)
            return (
              <button
                key={g.id}
                disabled={added}
                onClick={() =>
                  setPicked((p) => {
                    const n = new Set(p)
                    n.has(g.id) ? n.delete(g.id) : n.add(g.id)
                    return n
                  })
                }
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                  added ? "opacity-50" : "hover:bg-muted"
                )}
              >
                <span className={cn("flex size-5 flex-none items-center justify-center rounded-[6px] border transition-colors", on || added ? "border-primary bg-primary text-primary-foreground" : "border-[var(--l-hairline-strong)]")}>
                  {(on || added) && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <FileText className="size-4 flex-none text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{g.title}</span>
                <span className="flex-none text-[12px] text-muted-foreground">{added ? "Added" : `${g.stepCount} steps`}</span>
              </button>
            )
          })}
          {guides && guides.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {q ? `No published guides match “${q}”.` : "No published guides yet."}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-[var(--l-hairline)] px-4 py-3">
          <span className="text-[12px] text-muted-foreground">{picked.size} selected</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" disabled={picked.size === 0 || add.isPending} onClick={submit}>
              Add {picked.size || ""} {picked.size === 1 ? "article" : "articles"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Design ──────────────────────────────────────────────────────────────── */
function DesignSurface({ hc }: { hc: NonNullable<ReturnType<typeof useHelpCenter>["data"]> }) {
  const update = useUpdateHelpCenter()
  const [name, setName] = React.useState(hc.name)
  const [hero, setHero] = React.useState(hc.heroTitle)
  const [color, setColor] = React.useState(hc.brandColor ?? "#5e6ad2")
  const SWATCHES = ["#5e6ad2", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#16171b"]

  const setSwatch = (v: string) => {
    setColor(v)
    update.mutate({ brandColor: v })
  }

  return (
    <div className="grid gap-6 py-1 lg:grid-cols-[300px_1fr]">
      <div className="flex flex-col gap-5">
        <Field label="Help center name">
          <input className="di" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== hc.name && update.mutate({ name })} />
        </Field>
        <Field label="Brand color">
          <div className="flex flex-wrap gap-2">
            {SWATCHES.map((s) => (
              <button key={s} onClick={() => setSwatch(s)} style={{ background: s }} className={cn("size-8 rounded-lg ring-2 ring-offset-2 ring-offset-[var(--l-content-a)] transition-transform hover:scale-110", color === s ? "ring-foreground" : "ring-transparent")} />
            ))}
          </div>
        </Field>
        <Field label="Theme">
          <div className="grid grid-cols-3 gap-2">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                key={t}
                onClick={() => update.mutate({ theme: t })}
                className={cn("rounded-lg border py-2 text-[13px] font-medium capitalize transition-colors", hc.theme === t ? "border-primary bg-primary/10 text-primary" : "border-[var(--l-hairline)] bg-[var(--l-card)] hover:bg-muted")}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Hero headline">
          <input className="di" value={hero} onChange={(e) => setHero(e.target.value)} onBlur={() => hero !== hc.heroTitle && update.mutate({ heroTitle: hero })} />
        </Field>
        <style jsx>{`.di{height:2.25rem;width:100%;border-radius:.5rem;border:1px solid var(--l-hairline);background:var(--l-card);padding:0 .7rem;font-size:13.5px;outline:none}.di:focus{border-color:var(--cobalt)}`}</style>
      </div>

      <div>
        <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Sparkles className="size-3.5" /> Live preview</p>
        <div className="overflow-hidden rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-card)] shadow-[var(--l-card-shadow)]">
          <div className="flex items-center justify-between border-b border-[var(--l-hairline)] px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-md text-white" style={{ background: color }}><LogoMark className="size-4" /></span>
              <span className="text-[13.5px] font-semibold">{name || "Help Center"}</span>
            </div>
            <span className="rounded-md px-2.5 py-1 text-[12px] font-semibold text-white" style={{ background: color }}>Contact</span>
          </div>
          <div className="px-6 py-12 text-center" style={{ background: `radial-gradient(100% 70% at 50% -10%, color-mix(in srgb, ${color} 16%, transparent), transparent 70%)` }}>
            <h3 className="font-serif text-3xl font-medium tracking-tight">{hero || "How can we help you?"}</h3>
            <div className="mx-auto mt-5 flex max-w-md items-center gap-2.5 rounded-xl border border-[var(--l-hairline)] bg-[var(--l-card)] px-4 py-3 text-left text-[13px] text-muted-foreground shadow-sm">
              <Search className="size-4" /> Search for articles…
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Settings ────────────────────────────────────────────────────────────── */
function SettingsSurface({ hc }: { hc: NonNullable<ReturnType<typeof useHelpCenter>["data"]> }) {
  const update = useUpdateHelpCenter()
  const [slug, setSlug] = React.useState(hc.slug)
  const [seoTitle, setSeoTitle] = React.useState(hc.seo?.title ?? "")
  const [seoDesc, setSeoDesc] = React.useState(hc.seo?.description ?? "")

  return (
    <div className="mx-auto max-w-2xl py-1">
      <div className="flex flex-col gap-6">
        <Section icon={<Sparkles className="size-4" />} title="Public address">
          <div className="flex items-center gap-2 rounded-lg border border-[var(--l-hairline)] bg-[var(--l-card)] px-3 py-2 text-[13.5px]">
            <span className="text-muted-foreground">tacto.so/help/</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              onBlur={() =>
                slug !== hc.slug &&
                update.mutate(
                  { slug },
                  {
                    onError: () => {
                      setSlug(hc.slug)
                      toast.error("That address is taken or invalid")
                    },
                  }
                )
              }
              className="flex-1 bg-transparent font-medium outline-none"
            />
          </div>
          <p className="mt-2 text-[12px] text-muted-foreground">Custom domain — <span className="rounded bg-[var(--l-chrome)] px-1.5 py-0.5 ring-1 ring-[var(--l-hairline)]">Coming soon</span></p>
        </Section>

        <Section icon={<Eye className="size-4" />} title="Visibility">
          <div className="grid grid-cols-2 gap-2">
            <Choice title="Public" sub="Indexed by search engines" active={hc.listed} onClick={() => update.mutate({ listed: true })} />
            <Choice title="Unlisted" sub="Only people with the link" active={!hc.listed} onClick={() => update.mutate({ listed: false })} />
          </div>
        </Section>

        <Section icon={<Search className="size-4" />} title="SEO">
          <Field label="Meta title">
            <input className="si" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} onBlur={() => update.mutate({ seo: { title: seoTitle || undefined, description: seoDesc || undefined } })} />
          </Field>
          <Field label="Meta description">
            <textarea rows={2} className="si" value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} onBlur={() => update.mutate({ seo: { title: seoTitle || undefined, description: seoDesc || undefined } })} />
          </Field>
        </Section>

        <Section icon={<Settings2 className="size-4" />} title="Status page (optional)">
          <Field label="Status page URL">
            <input className="si" defaultValue={hc.statusUrl ?? ""} placeholder="https://status.acme.com" onBlur={(e) => update.mutate({ statusUrl: e.target.value.trim() || null })} />
          </Field>
        </Section>
      </div>
      <style jsx>{`.si{width:100%;border-radius:.5rem;border:1px solid var(--l-hairline);background:var(--l-card);padding:.5rem .7rem;font-size:13.5px;outline:none}.si:focus{border-color:var(--cobalt)}`}</style>
    </div>
  )
}

/* ── shared bits ─────────────────────────────────────────────────────────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-card)] p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><span className="text-muted-foreground">{icon}</span>{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}
function Choice({ title, sub, active, onClick }: { title: string; sub: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("rounded-xl border p-3 text-left transition-colors", active ? "border-primary bg-primary/5" : "border-[var(--l-hairline)] hover:border-[var(--l-hairline-strong)]")}>
      <span className="flex items-center gap-1.5 text-[13.5px] font-semibold">{title}{active && <Check className="size-3.5 text-primary" />}</span>
      <span className="mt-0.5 block text-[12px] text-muted-foreground">{sub}</span>
    </button>
  )
}
function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--l-hairline-strong)] px-6 py-16 text-center">
      <span className="text-muted-foreground">{icon}</span>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{body}</p>
    </div>
  )
}
function BuilderSkeleton() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-card)]" />
        ))}
      </div>
    </div>
  )
}
