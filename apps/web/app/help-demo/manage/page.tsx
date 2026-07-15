"use client"

/**
 * DUMMY DESIGN — Help Center builder (owner / "my user" side), inside the app's
 * double-sidebar shell (Rail + Help Center panel as the second column + content
 * card). Frontend only, mock data, no backend. Visit /help-demo/manage.
 */

import * as React from "react"
import { m } from "motion/react"
import {
  BarChart3,
  BookOpen,
  Check,
  ChevronRight,
  ClipboardList,
  Code2,
  Eye,
  FileText,
  GripVertical,
  LifeBuoy,
  Palette,
  Plus,
  Rocket,
  Search,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react"

import { LogoMark } from "@workspace/ui/components/logo"
import { cn } from "@workspace/ui/lib/utils"

import { RailButton, Reticle, ViewRow } from "@/components/app-shell/shell-bits"

/* ── mock data ───────────────────────────────────────────────────────────── */
const ICONS = { Rocket, BookOpen, Users, BarChart3, Code2, LifeBuoy } as const
type IconName = keyof typeof ICONS
type Collection = { id: string; name: string; icon: IconName; articleIds: string[] }
type Guide = { id: string; title: string; steps: number; status: "PUBLISHED" | "DRAFT" }

const GUIDES: Guide[] = [
  { id: "g1", title: "Creating your first guide", steps: 6, status: "PUBLISHED" },
  { id: "g2", title: "Customizing your guide", steps: 9, status: "PUBLISHED" },
  { id: "g3", title: "Inviting your team", steps: 5, status: "PUBLISHED" },
  { id: "g4", title: "Understanding analytics", steps: 7, status: "PUBLISHED" },
  { id: "g5", title: "Embedding guides in your app", steps: 8, status: "PUBLISHED" },
  { id: "g6", title: "Managing your subscription", steps: 4, status: "PUBLISHED" },
  { id: "g7", title: "Setting up SSO", steps: 8, status: "PUBLISHED" },
  { id: "g8", title: "Generating API keys", steps: 5, status: "PUBLISHED" },
  { id: "g9", title: "Draft: New onboarding flow", steps: 3, status: "DRAFT" },
]
const guideById = (id: string) => GUIDES.find((g) => g.id === id)!

const INITIAL: Collection[] = [
  { id: "c1", name: "Getting Started", icon: "Rocket", articleIds: ["g1", "g2", "g4"] },
  { id: "c2", name: "Account & Billing", icon: "BookOpen", articleIds: ["g6"] },
  { id: "c3", name: "Teams & Permissions", icon: "Users", articleIds: ["g3", "g7"] },
  { id: "c4", name: "Integrations", icon: "BarChart3", articleIds: ["g5"] },
  { id: "c5", name: "API Reference", icon: "Code2", articleIds: ["g8"] },
  { id: "c6", name: "Troubleshooting", icon: "LifeBuoy", articleIds: [] },
]

type Surface = "content" | "design" | "settings"

export default function ManageHelpCenterPage() {
  const [collections, setCollections] = React.useState(INITIAL)
  const [surface, setSurface] = React.useState<Surface>("content")
  const [selected, setSelected] = React.useState("c1")
  const [featured, setFeatured] = React.useState<Set<string>>(new Set(["g1", "g4"]))
  const [dirty, setDirty] = React.useState(false)
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [brand, setBrand] = React.useState({ name: "Acme Help Center", color: "#5e6ad2", hero: "How can we help you?" })

  const col = collections.find((c) => c.id === selected) ?? collections[0]!
  const touch = () => setDirty(true)
  const openCollection = (id: string) => { setSelected(id); setSurface("content") }

  function addArticles(ids: string[]) {
    setCollections((cs) => cs.map((c) => (c.id === selected ? { ...c, articleIds: [...new Set([...c.articleIds, ...ids])] } : c)))
    setPickerOpen(false); touch()
  }
  function removeArticle(id: string) {
    setCollections((cs) => cs.map((c) => (c.id === selected ? { ...c, articleIds: c.articleIds.filter((a) => a !== id) } : c))); touch()
  }
  function toggleFeatured(id: string) {
    setFeatured((f) => { const n = new Set(f); n.has(id) ? n.delete(id) : n.add(id); return n }); touch()
  }

  const title = surface === "content" ? col.name : surface === "design" ? "Design" : "Settings"

  return (
    <div className="relative flex h-svh overflow-hidden bg-[var(--l-canvas)] text-foreground">
      {/* ── Rail + Help Center panel (the double sidebar) ── */}
      <div className="z-50 flex h-svh bg-gradient-to-b from-[var(--l-rail-a)] to-[var(--l-rail-b)]">
        <DemoRail />
        <HelpCenterPanel
          collections={collections}
          surface={surface}
          selected={selected}
          onOpenCollection={openCollection}
          onSurface={setSurface}
          onNewCollection={() => {
            const id = `c${collections.length + 1}`
            setCollections((cs) => [...cs, { id, name: "New collection", icon: "BookOpen", articleIds: [] }])
            openCollection(id); touch()
          }}
        />
      </div>

      {/* ── Content card ── */}
      <main className="mt-1.5 mr-1.5 mb-1.5 flex min-w-0 flex-1 flex-col overflow-hidden rounded-r-3xl border-t border-r border-b border-[var(--l-hairline)] bg-gradient-to-b from-[var(--l-content-a)] to-[var(--l-content-b)]">
        <header className="flex h-14 flex-none items-center justify-between gap-3 border-b border-[var(--l-hairline)] px-5">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-[15px] font-semibold">{title}</h1>
            <span className="rounded-full bg-[var(--l-chrome)] px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-[var(--l-hairline)]">Draft</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="mr-1 text-xs text-muted-foreground">{dirty ? "Unsaved changes" : "Saved"}</span>
            <a href="/help-demo" target="_blank" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--l-hairline)] px-3 py-1.5 text-[13px] font-semibold transition-colors hover:border-[var(--l-hairline-strong)]">
              <Eye className="size-4" /> Preview
            </a>
            <button disabled={!dirty} onClick={() => setDirty(false)} className="rounded-lg bg-primary px-3.5 py-1.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-40">
              Publish
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {surface === "content" && (
            <ArticlesSurface col={col} featured={featured} onAdd={() => setPickerOpen(true)} onRemove={removeArticle} onToggleFeatured={toggleFeatured} />
          )}
          {surface === "design" && <DesignSurface brand={brand} onChange={(b) => { setBrand(b); touch() }} />}
          {surface === "settings" && <SettingsSurface />}
        </div>
      </main>

      {pickerOpen && <AddArticlesModal already={col.articleIds} onClose={() => setPickerOpen(false)} onAdd={addArticles} />}
    </div>
  )
}

/* ── Rail (static replica of the app rail) ───────────────────────────────── */
function DemoRail() {
  return (
    <nav className="flex w-14 flex-none flex-col items-center gap-1.5 py-3.5">
      <button aria-label="Workspace" className="mb-2 flex size-10 items-center justify-center rounded-xl text-cobalt transition-colors hover:bg-[var(--l-hover)]">
        <Reticle />
      </button>
      <RailButton label="Library">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 5a1 1 0 0 1 1-1h5l2 2h7a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
        </svg>
      </RailButton>
      <RailButton label="Forms">
        <ClipboardList className="size-[19px]" />
      </RailButton>
      <RailButton label="Analytics">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        </svg>
      </RailButton>
      <RailButton label="Teams">
        <Users className="size-[19px]" />
      </RailButton>
      <div className="flex-1" />
      <RailButton label="Help center" active>
        <LifeBuoy className="size-[19px]" />
      </RailButton>
      <RailButton label="Settings">
        <Settings2 className="size-[19px]" />
      </RailButton>
      <span className="mt-1 flex size-8 items-center justify-center rounded-lg bg-ink text-xs font-semibold text-paper">A</span>
    </nav>
  )
}

/* ── Help Center panel (the double sidebar's second column) ──────────────── */
function HelpCenterPanel({
  collections, surface, selected, onOpenCollection, onSurface, onNewCollection,
}: {
  collections: Collection[]; surface: Surface; selected: string
  onOpenCollection: (id: string) => void; onSurface: (s: Surface) => void; onNewCollection: () => void
}) {
  const totalArticles = collections.reduce((n, c) => n + c.articleIds.length, 0)
  return (
    <aside className="mt-1.5 mb-1.5 flex w-64 flex-none flex-col overflow-hidden rounded-l-3xl border-t border-r border-b border-l border-[var(--l-hairline)] bg-gradient-to-b from-[var(--l-panel-a)] to-[var(--l-panel-b)]">
      <div className="flex h-14 items-center justify-between border-b border-[var(--l-hairline)] px-4">
        <h2 className="text-[15px] font-semibold tracking-tight">Help Center</h2>
        <button aria-label="New collection" onClick={onNewCollection} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
          <Plus className="size-4" />
        </button>
      </div>

      <div className="px-3 pt-3">
        <div className="flex h-8 items-center gap-2 rounded-lg border border-[var(--l-hairline)] bg-plate px-2.5 transition-colors focus-within:border-cobalt">
          <Search className="size-3.5 text-muted-foreground" />
          <input placeholder="Search…" aria-label="Search collections" className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <ViewRow
          active={false}
          onClick={() => onOpenCollection(collections[0]!.id)}
          icon={<FileText className="size-4" />}
          label="All articles"
          count={totalArticles}
        />

        <div className="mt-4 mb-1 flex items-center justify-between px-2.5">
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Collections</span>
          <button aria-label="New collection" onClick={onNewCollection} className="text-muted-foreground hover:text-foreground">
            <Plus className="size-3.5" />
          </button>
        </div>

        {collections.map((c) => {
          const Icon = ICONS[c.icon]
          const active = surface === "content" && c.id === selected
          return (
            <div key={c.id} className={cn("group flex items-center rounded-lg pr-1 transition-colors", active ? "bg-foreground/[0.09]" : "hover:bg-foreground/[0.06]")}>
              <button onClick={() => onOpenCollection(c.id)} className={cn("flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-[13px]", active ? "font-medium text-cobalt-ink" : "text-foreground")}>
                <Icon className={cn("size-4 flex-none", active ? "text-cobalt" : "text-muted-foreground")} />
                <span className="truncate">{c.name}</span>
              </button>
              <span className="mr-1 font-mono text-[10px] text-muted-foreground">{c.articleIds.length}</span>
            </div>
          )
        })}
      </div>

      {/* bottom: Design + Settings (like the form builder's left-panel footer) */}
      <div className="border-t border-[var(--l-hairline)] p-2">
        <PanelNav icon={<Palette className="size-4" />} label="Design" active={surface === "design"} onClick={() => onSurface("design")} />
        <PanelNav icon={<Settings2 className="size-4" />} label="Settings" active={surface === "settings"} onClick={() => onSurface("settings")} />
      </div>
    </aside>
  )
}

function PanelNav({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors", active ? "bg-primary/10 font-medium text-cobalt" : "text-foreground hover:bg-foreground/[0.06]")}>
      {icon}
      {label}
    </button>
  )
}

/* ── Articles surface ────────────────────────────────────────────────────── */
function ArticlesSurface({
  col, featured, onAdd, onRemove, onToggleFeatured,
}: {
  col: Collection; featured: Set<string>; onAdd: () => void; onRemove: (id: string) => void; onToggleFeatured: (id: string) => void
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-7 sm:px-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">{col.articleIds.length} {col.articleIds.length === 1 ? "article" : "articles"} in this collection</p>
        <button onClick={onAdd} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]">
          <Plus className="size-4" /> Add articles
        </button>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        {col.articleIds.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--l-hairline-strong)] bg-[var(--l-card)] px-6 py-14 text-center">
            <FileText className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">No articles yet</p>
            <p className="mt-1 text-[13px] text-muted-foreground">Add published guides to this collection.</p>
            <button onClick={onAdd} className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[var(--l-hairline)] bg-[var(--l-card)] px-3 py-1.5 text-[13px] font-semibold transition-colors hover:border-primary hover:text-primary">
              <Plus className="size-4" /> Add articles
            </button>
          </div>
        ) : (
          col.articleIds.map((id) => {
            const g = guideById(id)
            const feat = featured.has(id)
            return (
              <m.div key={id} layout className="group flex items-center gap-3 rounded-xl border border-[var(--l-hairline)] bg-[var(--l-card)] px-3 py-2.5 shadow-[inset_0_1px_0_var(--l-edge)]">
                <GripVertical className="size-4 flex-none cursor-grab text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                <span className="flex size-8 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{g.title}</span>
                  <span className="block text-[12px] text-muted-foreground">{g.steps} steps · published</span>
                </span>
                <button onClick={() => onToggleFeatured(id)} aria-label="Feature on homepage" title="Feature on homepage" className={cn("flex size-8 items-center justify-center rounded-lg transition-colors", feat ? "text-amber-500" : "text-muted-foreground hover:text-foreground")}>
                  <Star className={cn("size-4", feat && "fill-current")} />
                </button>
                <button onClick={() => onRemove(id)} aria-label="Remove" className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-rose-500">
                  <Trash2 className="size-4" />
                </button>
              </m.div>
            )
          })
        )}
      </div>
    </div>
  )
}

/* ── Design surface (branding + live preview) ────────────────────────────── */
function DesignSurface({ brand, onChange }: { brand: { name: string; color: string; hero: string }; onChange: (b: { name: string; color: string; hero: string }) => void }) {
  const SWATCHES = ["#5e6ad2", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#16171b"]
  return (
    <div className="grid gap-6 px-6 py-7 sm:px-8 lg:grid-cols-[300px_1fr]">
      <div className="flex flex-col gap-5">
        <Field label="Help center name">
          <input value={brand.name} onChange={(e) => onChange({ ...brand, name: e.target.value })} className="di" />
        </Field>
        <Field label="Logo">
          <button className="flex h-24 w-full items-center justify-center rounded-xl border border-dashed border-[var(--l-hairline-strong)] bg-[var(--l-card)] text-[13px] text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            <Plus className="mr-1.5 size-4" /> Upload logo
          </button>
        </Field>
        <Field label="Brand color">
          <div className="flex flex-wrap gap-2">
            {SWATCHES.map((s) => (
              <button key={s} onClick={() => onChange({ ...brand, color: s })} style={{ background: s }} className={cn("size-8 rounded-lg ring-2 ring-offset-2 ring-offset-[var(--l-content-a)] transition-transform hover:scale-110", brand.color === s ? "ring-foreground" : "ring-transparent")} />
            ))}
          </div>
        </Field>
        <Field label="Theme">
          <div className="grid grid-cols-3 gap-2">
            {["Light", "Dark", "System"].map((t, i) => (
              <button key={t} className={cn("rounded-lg border py-2 text-[13px] font-medium transition-colors", i === 0 ? "border-primary bg-primary/10 text-primary" : "border-[var(--l-hairline)] bg-[var(--l-card)] hover:bg-muted")}>{t}</button>
            ))}
          </div>
        </Field>
        <Field label="Hero headline">
          <input value={brand.hero} onChange={(e) => onChange({ ...brand, hero: e.target.value })} className="di" />
        </Field>
        <style jsx>{`.di{height:2.25rem;width:100%;border-radius:.5rem;border:1px solid var(--l-hairline);background:var(--l-card);padding:0 .7rem;font-size:13.5px;outline:none}.di:focus{border-color:var(--cobalt)}`}</style>
      </div>

      <div>
        <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Sparkles className="size-3.5" /> Live preview — updates as you type</p>
        <div className="overflow-hidden rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-card)] shadow-[var(--l-card-shadow)]">
          <div className="flex items-center justify-between border-b border-[var(--l-hairline)] px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-md text-white" style={{ background: brand.color }}><LogoMark className="size-4" /></span>
              <span className="text-[13.5px] font-semibold">{brand.name}</span>
            </div>
            <span className="rounded-md px-2.5 py-1 text-[12px] font-semibold text-white" style={{ background: brand.color }}>Contact</span>
          </div>
          <div className="px-6 py-12 text-center" style={{ background: `radial-gradient(100% 70% at 50% -10%, color-mix(in srgb, ${brand.color} 16%, transparent), transparent 70%)` }}>
            <h3 className="font-serif text-3xl font-medium tracking-tight">{brand.hero || "How can we help you?"}</h3>
            <div className="mx-auto mt-5 flex max-w-md items-center gap-2.5 rounded-xl border border-[var(--l-hairline)] bg-[var(--l-card)] px-4 py-3 text-left text-[13px] text-muted-foreground shadow-sm">
              <Search className="size-4" /> Search for articles…
            </div>
            <div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3">
              {[LifeBuoy, Users].map((Icon, i) => (
                <div key={i} className="rounded-xl border border-[var(--l-hairline)] bg-[var(--l-card)] p-3 text-left">
                  <span className="flex size-8 items-center justify-center rounded-lg" style={{ background: `color-mix(in srgb, ${brand.color} 12%, transparent)`, color: brand.color }}><Icon className="size-4" /></span>
                  <p className="mt-2 text-[13px] font-semibold">{i === 0 ? "Getting Started" : "Teams"}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

/* ── Settings surface ────────────────────────────────────────────────────── */
function SettingsSurface() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-7 sm:px-8">
      <div className="flex flex-col gap-6">
        <Section icon={<Sparkles className="size-4" />} title="Public address">
          <div className="flex items-center gap-2 rounded-lg border border-[var(--l-hairline)] bg-[var(--l-card)] px-3 py-2 text-[13.5px]">
            <span className="text-muted-foreground">tacto.so/help/</span>
            <input defaultValue="acme" className="flex-1 bg-transparent font-medium outline-none" />
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--l-success)]"><Check className="size-3.5" /> Available</span>
          </div>
          <p className="mt-2 text-[12px] text-muted-foreground">Custom domain — <span className="rounded bg-[var(--l-chrome)] px-1.5 py-0.5 ring-1 ring-[var(--l-hairline)]">Coming soon</span></p>
        </Section>

        <Section icon={<Eye className="size-4" />} title="Visibility">
          <div className="grid grid-cols-2 gap-2">
            <Choice title="Public" sub="Indexed by search engines" active />
            <Choice title="Unlisted" sub="Only people with the link" />
          </div>
        </Section>

        <Section icon={<Search className="size-4" />} title="SEO">
          <Field label="Meta title"><input defaultValue="Acme Help Center" className="si" /></Field>
          <Field label="Meta description"><textarea rows={2} defaultValue="Guides and answers for Acme." className="si" /></Field>
        </Section>

        <Section icon={<Settings2 className="size-4" />} title="Contact">
          <Field label="“Submit a request” form">
            <div className="flex items-center justify-between rounded-lg border border-[var(--l-hairline)] bg-[var(--l-card)] px-3 py-2 text-[13.5px]">
              Support request form
              <ChevronRight className="size-4 text-muted-foreground" />
            </div>
          </Field>
        </Section>
      </div>
      <style jsx>{`.si{width:100%;border-radius:.5rem;border:1px solid var(--l-hairline);background:var(--l-card);padding:.5rem .7rem;font-size:13.5px;outline:none}.si:focus{border-color:var(--cobalt)}`}</style>
    </div>
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

function Choice({ title, sub, active }: { title: string; sub: string; active?: boolean }) {
  return (
    <button className={cn("rounded-xl border p-3 text-left transition-colors", active ? "border-primary bg-primary/5" : "border-[var(--l-hairline)] hover:border-[var(--l-hairline-strong)]")}>
      <span className="flex items-center gap-1.5 text-[13.5px] font-semibold">{title}{active && <Check className="size-3.5 text-primary" />}</span>
      <span className="mt-0.5 block text-[12px] text-muted-foreground">{sub}</span>
    </button>
  )
}

/* ── add-articles picker ─────────────────────────────────────────────────── */
function AddArticlesModal({ already, onClose, onAdd }: { already: string[]; onClose: () => void; onAdd: (ids: string[]) => void }) {
  const [q, setQ] = React.useState("")
  const [picked, setPicked] = React.useState<Set<string>>(new Set())
  const results = GUIDES.filter((g) => g.status === "PUBLISHED" && g.title.toLowerCase().includes(q.trim().toLowerCase()))

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={onClose} />
      <div className="relative flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-card)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-[var(--l-hairline)] px-4 py-3">
          <h3 className="text-sm font-semibold">Add published guides</h3>
          <button onClick={onClose} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
        </div>
        <div className="flex items-center gap-2.5 border-b border-[var(--l-hairline)] px-4">
          <Search className="size-4 text-muted-foreground" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your published guides…" className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {results.map((g) => {
            const added = already.includes(g.id)
            const on = picked.has(g.id)
            return (
              <button key={g.id} disabled={added} onClick={() => setPicked((p) => { const n = new Set(p); n.has(g.id) ? n.delete(g.id) : n.add(g.id); return n })} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors", added ? "opacity-50" : "hover:bg-muted")}>
                <span className={cn("flex size-5 flex-none items-center justify-center rounded-[6px] border transition-colors", on || added ? "border-primary bg-primary text-primary-foreground" : "border-[var(--l-hairline-strong)]")}>
                  {(on || added) && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <FileText className="size-4 flex-none text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{g.title}</span>
                <span className="flex-none text-[12px] text-muted-foreground">{added ? "Added" : `${g.steps} steps`}</span>
              </button>
            )
          })}
          {results.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted-foreground">No published guides match “{q}”.</p>}
        </div>
        <div className="flex items-center justify-between border-t border-[var(--l-hairline)] px-4 py-3">
          <span className="text-[12px] text-muted-foreground">{picked.size} selected</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground">Cancel</button>
            <button disabled={picked.size === 0} onClick={() => onAdd([...picked])} className="rounded-lg bg-primary px-3.5 py-1.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-40">
              Add {picked.size || ""} {picked.size === 1 ? "article" : "articles"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
