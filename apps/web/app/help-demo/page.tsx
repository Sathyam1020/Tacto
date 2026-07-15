"use client"

/**
 * DUMMY DESIGN — public Help Center (visitor side). Frontend only, mock data,
 * no backend. Re-skins the reference layout into the Datum theme. Visit
 * /help-demo. Three client-switched views (home → collection → article) + a
 * ⌘K search overlay demonstrate the full visitor flow.
 */

import * as React from "react"
import { m } from "motion/react"
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  ChevronRight,
  Code2,
  FileText,
  Globe,
  Headphones,
  LifeBuoy,
  Moon,
  Rocket,
  Search,
  Send,
  Sun,
  Users,
  Check,
} from "lucide-react"

import { LogoMark } from "@workspace/ui/components/logo"
import { cn } from "@workspace/ui/lib/utils"

/* ── mock data ───────────────────────────────────────────────────────────── */
type Collection = {
  slug: string
  name: string
  desc: string
  icon: React.ComponentType<{ className?: string }>
  tint: string
  count: number
}
const COLLECTIONS: Collection[] = [
  { slug: "getting-started", name: "Getting Started", desc: "New to Acme? Everything you need to get up and running.", icon: Rocket, tint: "text-cobalt", count: 12 },
  { slug: "account-billing", name: "Account & Billing", desc: "Manage your account, billing, and subscription.", icon: BookOpen, tint: "text-sky-600", count: 18 },
  { slug: "teams", name: "Teams & Permissions", desc: "Invite teammates and manage roles and access.", icon: Users, tint: "text-emerald-600", count: 15 },
  { slug: "integrations", name: "Integrations", desc: "Connect Acme with your favorite tools.", icon: BarChart3, tint: "text-amber-600", count: 21 },
  { slug: "api", name: "API Reference", desc: "Technical docs and resources for developers.", icon: Code2, tint: "text-rose-600", count: 34 },
  { slug: "troubleshooting", name: "Troubleshooting", desc: "Solutions to common issues and error messages.", icon: LifeBuoy, tint: "text-violet-600", count: 9 },
]

type Article = { slug: string; title: string; excerpt: string; read: number; collection: string }
const ARTICLES: Article[] = [
  { slug: "creating-your-first-guide", title: "Creating your first guide", excerpt: "Create and publish your first interactive guide in under 5 minutes.", read: 5, collection: "getting-started" },
  { slug: "customizing-your-guide", title: "Customizing your guide", excerpt: "Add branding, customize styles, and make guides match your product.", read: 7, collection: "getting-started" },
  { slug: "inviting-your-team", title: "Inviting your team", excerpt: "Add teammates, set roles, and manage permissions.", read: 4, collection: "teams" },
  { slug: "understanding-analytics", title: "Understanding analytics", excerpt: "Track engagement, completions, and see what's working.", read: 6, collection: "getting-started" },
  { slug: "embedding-guides", title: "Embedding guides in your app", excerpt: "Embed guides and launch them directly from your product.", read: 6, collection: "integrations" },
  { slug: "managing-billing", title: "Managing your subscription", excerpt: "Upgrade, downgrade, and update payment methods.", read: 3, collection: "account-billing" },
  { slug: "sso-setup", title: "Setting up SSO", excerpt: "Configure single sign-on for your workspace.", read: 8, collection: "teams" },
  { slug: "api-keys", title: "Generating API keys", excerpt: "Create and rotate keys for the Acme API.", read: 5, collection: "api" },
]
const FEATURED = ARTICLES.slice(0, 5)

/* ── view state ──────────────────────────────────────────────────────────── */
type View =
  | { name: "home" }
  | { name: "collection"; slug: string }
  | { name: "article"; slug: string }

export default function HelpDemoPage() {
  const [view, setView] = React.useState<View>({ name: "home" })
  const [dark, setDark] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)

  React.useEffect(() => {
    const el = document.documentElement
    el.setAttribute("data-theme", dark ? "dark" : "light")
    return () => el.removeAttribute("data-theme")
  }, [dark])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const go = (v: View) => {
    setView(v)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="min-h-svh bg-[var(--l-canvas)] text-[var(--l-ink)]">
      <SiteHeader onHome={() => go({ name: "home" })} onSearch={() => setSearchOpen(true)} dark={dark} onToggleTheme={() => setDark((d) => !d)} />

      {view.name === "home" && <Home onOpenCollection={(slug) => go({ name: "collection", slug })} onOpenArticle={(slug) => go({ name: "article", slug })} onSearch={() => setSearchOpen(true)} />}
      {view.name === "collection" && <CollectionView slug={view.slug} onHome={() => go({ name: "home" })} onOpenArticle={(slug) => go({ name: "article", slug })} onOpenCollection={(slug) => go({ name: "collection", slug })} />}
      {view.name === "article" && <ArticleView slug={view.slug} onHome={() => go({ name: "home" })} onOpenCollection={(slug) => go({ name: "collection", slug })} onOpenArticle={(slug) => go({ name: "article", slug })} />}

      <SiteFooter dark={dark} onToggleTheme={() => setDark((d) => !d)} />

      {searchOpen && (
        <SearchOverlay
          onClose={() => setSearchOpen(false)}
          onOpenArticle={(slug) => {
            setSearchOpen(false)
            go({ name: "article", slug })
          }}
        />
      )}
    </div>
  )
}

/* ── chrome ──────────────────────────────────────────────────────────────── */
function SiteHeader({ onHome, onSearch, dark, onToggleTheme }: { onHome: () => void; onSearch: () => void; dark: boolean; onToggleTheme: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--l-hairline)] bg-[var(--l-card)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
        <button onClick={onHome} className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LogoMark className="size-5" />
          </span>
          <span className="flex items-center gap-2.5 text-[15px] font-semibold">
            Acme
            <span className="h-4 w-px bg-[var(--l-hairline-strong)]" />
            <span className="font-medium text-[var(--l-ink-subtle)]">Help Center</span>
          </span>
        </button>
        <nav className="hidden items-center gap-7 text-[13.5px] font-medium text-[var(--l-ink-subtle)] md:flex">
          <a className="transition-colors hover:text-[var(--l-ink)]" href="#">Guides</a>
          <a className="transition-colors hover:text-[var(--l-ink)]" href="#">API Reference</a>
          <a className="inline-flex items-center gap-1.5 transition-colors hover:text-[var(--l-ink)]" href="#">
            Status <span className="size-1.5 rounded-full bg-[var(--l-success)]" />
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <button onClick={onSearch} aria-label="Search" className="flex size-9 items-center justify-center rounded-lg text-[var(--l-ink-subtle)] transition-colors hover:bg-[var(--l-hover)] hover:text-[var(--l-ink)] md:hidden">
            <Search className="size-4" />
          </button>
          <button onClick={onToggleTheme} aria-label="Toggle theme" className="flex size-9 items-center justify-center rounded-lg text-[var(--l-ink-subtle)] transition-colors hover:bg-[var(--l-hover)] hover:text-[var(--l-ink)]">
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <button className="rounded-lg border border-primary/40 px-3.5 py-2 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/5">
            Contact Support
          </button>
        </div>
      </div>
    </header>
  )
}

function SiteFooter({ dark, onToggleTheme }: { dark: boolean; onToggleTheme: () => void }) {
  return (
    <footer className="border-t border-[var(--l-hairline)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <LogoMark className="size-4" />
          </span>
          <div className="text-xs text-[var(--l-ink-subtle)]">
            <p className="font-semibold text-[var(--l-ink)]">Acme Help Center</p>
            <p>© 2026 Acme Inc. All rights reserved.</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-xs font-medium text-[var(--l-ink-subtle)]">
          <a className="hover:text-[var(--l-ink)]" href="#">Privacy</a>
          <a className="hover:text-[var(--l-ink)]" href="#">Terms</a>
          <a className="hover:text-[var(--l-ink)]" href="#">Cookies</a>
          <button onClick={onToggleTheme} aria-label="Toggle theme" className="flex size-8 items-center justify-center rounded-md hover:bg-[var(--l-hover)] hover:text-[var(--l-ink)]">
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--l-hairline)] px-2.5 py-1.5 text-[var(--l-ink)]">
            <Globe className="size-3.5" /> English
          </span>
        </div>
      </div>
    </footer>
  )
}

/* ── home ────────────────────────────────────────────────────────────────── */
function Home({ onOpenCollection, onOpenArticle, onSearch }: { onOpenCollection: (s: string) => void; onOpenArticle: (s: string) => void; onSearch: () => void }) {
  return (
    <>
      {/* hero */}
      <section className="relative overflow-hidden border-b border-[var(--l-hairline)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
          style={{ background: "radial-gradient(120% 80% at 50% -10%, color-mix(in srgb, var(--cobalt) 16%, transparent), transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-3xl px-6 pb-14 pt-20 text-center">
          <h1 className="font-serif text-[44px] font-medium leading-[1.05] tracking-tight text-balance sm:text-[52px]">
            How can we help you?
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-[var(--l-ink-subtle)]">
            Find step-by-step guides and answers to common questions about Acme and our products.
          </p>
          <button
            onClick={onSearch}
            className="group mx-auto mt-8 flex w-full items-center gap-3 rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-card)] px-5 py-4 text-left shadow-[var(--l-card-shadow)] transition-all hover:border-primary/40"
          >
            <Search className="size-5 text-[var(--l-ink-tertiary)] transition-colors group-hover:text-primary" />
            <span className="flex-1 text-[15px] text-[var(--l-ink-tertiary)]">Search for articles, guides, or keywords…</span>
            <kbd className="hidden rounded-md border border-[var(--l-hairline)] bg-[var(--l-chrome)] px-2 py-1 font-mono text-[11px] text-[var(--l-ink-subtle)] sm:block">⌘ K</kbd>
          </button>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-6 py-12">
        {/* collection grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COLLECTIONS.map((c) => (
            <m.button
              key={c.slug}
              onClick={() => onOpenCollection(c.slug)}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.99 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="group flex flex-col rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-card)] p-5 text-left shadow-[inset_0_1px_0_var(--l-edge)] transition-[border-color,box-shadow] hover:border-[var(--l-hairline-strong)] hover:shadow-[var(--l-card-shadow)]"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--l-chrome)] ring-1 ring-[var(--l-hairline)] transition-transform group-hover:scale-105">
                <c.icon className={cn("size-5", c.tint)} />
              </span>
              <h3 className="mt-4 text-[15px] font-semibold">{c.name}</h3>
              <p className="mt-1.5 line-clamp-2 flex-1 text-[13px] leading-relaxed text-[var(--l-ink-subtle)]">{c.desc}</p>
              <div className="mt-5 flex items-center justify-between border-t border-[var(--l-hairline)] pt-3">
                <span className="text-xs font-medium text-[var(--l-ink-tertiary)]">{c.count} articles</span>
                <ChevronRight className="size-4 text-[var(--l-ink-tertiary)] transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
            </m.button>
          ))}
        </div>

        {/* popular + rail */}
        <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_320px]">
          <section>
            <h2 className="mb-4 text-lg font-semibold tracking-tight">Popular articles</h2>
            <div className="overflow-hidden rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-card)]">
              {FEATURED.map((a, i) => (
                <ArticleRow key={a.slug} article={a} onClick={() => onOpenArticle(a.slug)} divide={i > 0} />
              ))}
            </div>
            <div className="mt-4 flex justify-center">
              <button className="rounded-lg border border-[var(--l-hairline)] bg-[var(--l-card)] px-4 py-2 text-[13px] font-semibold transition-colors hover:border-[var(--l-hairline-strong)]">
                View all articles
              </button>
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            <div className="rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-card)] p-5">
              <h3 className="text-sm font-semibold">Still need help?</h3>
              <div className="mt-3 flex flex-col gap-1">
                <RailAction icon={<Headphones className="size-4" />} title="Contact Support" sub="Get help from our team" />
                <RailAction icon={<Send className="size-4" />} title="Submit a Request" sub="We typically reply in 24h" />
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-card)] p-5">
              <h3 className="text-sm font-semibold">System Status</h3>
              <div className="mt-3 flex items-center gap-2 text-[13px]">
                <span className="flex size-5 items-center justify-center rounded-full bg-[var(--l-success)]/15 text-[var(--l-success)]">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                All systems operational
              </div>
              <a href="#" className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline">
                View status page
              </a>
            </div>
          </aside>
        </div>
      </main>
    </>
  )
}

function RailAction({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <button className="group flex items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-[var(--l-hover)]">
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold">{title}</span>
        <span className="block text-xs text-[var(--l-ink-subtle)]">{sub}</span>
      </span>
      <ChevronRight className="size-4 text-[var(--l-ink-tertiary)] transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}

function ArticleRow({ article, onClick, divide }: { article: Article; onClick: () => void; divide?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--l-hover)]",
        divide && "border-t border-[var(--l-hairline)]"
      )}
    >
      <span className="flex size-9 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
        <FileText className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold">{article.title}</span>
        <span className="mt-0.5 block truncate text-[13px] text-[var(--l-ink-subtle)]">{article.excerpt}</span>
      </span>
      <span className="hidden flex-none text-xs text-[var(--l-ink-tertiary)] tabular-nums sm:block">{article.read} min read</span>
      <ChevronRight className="size-4 flex-none text-[var(--l-ink-tertiary)] transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  )
}

/* ── collection ──────────────────────────────────────────────────────────── */
function CollectionView({ slug, onHome, onOpenArticle, onOpenCollection }: { slug: string; onHome: () => void; onOpenArticle: (s: string) => void; onOpenCollection: (s: string) => void }) {
  const col = COLLECTIONS.find((c) => c.slug === slug) ?? COLLECTIONS[0]!
  const items = ARTICLES.filter((a) => a.collection === slug)
  const list = items.length ? items : ARTICLES.slice(0, 4)
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Breadcrumb onHome={onHome} trail={[col.name]} />
      <div className="mt-6 grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <p className="mb-2 px-2 font-mono text-[10px] uppercase tracking-widest text-[var(--l-ink-tertiary)]">Collections</p>
          <nav className="flex flex-col gap-0.5">
            {COLLECTIONS.map((c) => (
              <button
                key={c.slug}
                onClick={() => onOpenCollection(c.slug)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors",
                  c.slug === slug ? "bg-primary/10 font-medium text-primary" : "text-[var(--l-ink-subtle)] hover:bg-[var(--l-hover)] hover:text-[var(--l-ink)]"
                )}
              >
                <c.icon className="size-4 flex-none" />
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </nav>
        </aside>

        <section>
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--l-chrome)] ring-1 ring-[var(--l-hairline)]">
              <col.icon className={cn("size-5", col.tint)} />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{col.name}</h1>
              <p className="text-[13.5px] text-[var(--l-ink-subtle)]">{col.desc}</p>
            </div>
          </div>
          <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-card)]">
            {list.map((a, i) => (
              <ArticleRow key={a.slug} article={a} onClick={() => onOpenArticle(a.slug)} divide={i > 0} />
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

/* ── article (guide reader mock) ─────────────────────────────────────────── */
function ArticleView({ slug, onHome, onOpenCollection, onOpenArticle }: { slug: string; onHome: () => void; onOpenCollection: (s: string) => void; onOpenArticle: (s: string) => void }) {
  const article = ARTICLES.find((a) => a.slug === slug) ?? ARTICLES[0]!
  const col = COLLECTIONS.find((c) => c.slug === article.collection) ?? COLLECTIONS[0]!
  const related = ARTICLES.filter((a) => a.collection === article.collection && a.slug !== article.slug).slice(0, 3)
  const steps = [
    "Open your dashboard and click the New Guide button in the top-right corner.",
    "Choose Start from a recording, then walk through the flow you want to document.",
    "Review the auto-generated steps — edit any text or reorder as needed.",
    "Click Publish, and copy the share link to send it or add it to your help center.",
  ]
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Breadcrumb onHome={onHome} trail={[col.name, article.title]} onTrailClick={[() => onOpenCollection(col.slug)]} />
      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_240px]">
        <article className="min-w-0">
          <h1 className="font-serif text-[34px] font-medium leading-tight tracking-tight text-balance">{article.title}</h1>
          <p className="mt-3 text-[17px] leading-relaxed text-[var(--l-ink-subtle)]">{article.excerpt}</p>
          <p className="mt-4 border-b border-[var(--l-hairline)] pb-6 font-mono text-xs text-[var(--l-ink-tertiary)]">{steps.length} steps · {article.read} min read</p>

          <div className="mt-8 flex flex-col gap-8">
            {steps.map((s, i) => (
              <div key={i} className="flex gap-5">
                <div className="flex flex-col items-center">
                  <span className="flex size-8 flex-none items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-primary-foreground">{i + 1}</span>
                  {i < steps.length - 1 && <span className="mt-2 -mb-8 w-px flex-1 bg-[var(--l-hairline-strong)]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] leading-relaxed">{s}</p>
                  <div className="mt-4 flex aspect-[2/1] items-center justify-center rounded-xl border border-[var(--l-hairline)] bg-[var(--l-preview)] text-xs text-[var(--l-ink-tertiary)]">
                    screenshot
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* helpful */}
          <div className="mt-12 flex flex-col items-center gap-3 rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-card)] p-6 text-center">
            <p className="text-sm font-semibold">Was this helpful?</p>
            <div className="flex gap-2">
              <button className="rounded-lg border border-[var(--l-hairline)] px-4 py-2 text-sm transition-colors hover:border-primary hover:text-primary">👍 Yes</button>
              <button className="rounded-lg border border-[var(--l-hairline)] px-4 py-2 text-sm transition-colors hover:border-primary hover:text-primary">👎 No</button>
            </div>
          </div>
        </article>

        {/* on this page / related */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--l-ink-tertiary)]">Related articles</p>
            <div className="flex flex-col gap-0.5">
              {related.map((a) => (
                <button key={a.slug} onClick={() => onOpenArticle(a.slug)} className="rounded-lg px-2.5 py-2 text-left text-[13px] text-[var(--l-ink-subtle)] transition-colors hover:bg-[var(--l-hover)] hover:text-[var(--l-ink)]">
                  {a.title}
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-[var(--l-hairline)] bg-[var(--l-card)] p-4">
              <p className="text-[13px] font-semibold">Still stuck?</p>
              <button className="mt-2 w-full rounded-lg bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]">
                Contact support
              </button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}

function Breadcrumb({ onHome, trail, onTrailClick }: { onHome: () => void; trail: string[]; onTrailClick?: (() => void)[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-[13px] text-[var(--l-ink-subtle)]">
      <button onClick={onHome} className="inline-flex items-center gap-1 transition-colors hover:text-[var(--l-ink)]">
        <ArrowLeft className="size-3.5" /> Help Center
      </button>
      {trail.map((t, i) => (
        <React.Fragment key={i}>
          <ChevronRight className="size-3.5 text-[var(--l-ink-tertiary)]" />
          {onTrailClick?.[i] ? (
            <button onClick={onTrailClick[i]} className="transition-colors hover:text-[var(--l-ink)]">{t}</button>
          ) : (
            <span className={cn(i === trail.length - 1 && "truncate font-medium text-[var(--l-ink)]")}>{t}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}

/* ── search overlay (⌘K) ─────────────────────────────────────────────────── */
function SearchOverlay({ onClose, onOpenArticle }: { onClose: () => void; onOpenArticle: (s: string) => void }) {
  const [q, setQ] = React.useState("")
  const results = React.useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return ARTICLES.slice(0, 5)
    return ARTICLES.filter((a) => (a.title + a.excerpt).toLowerCase().includes(t))
  }, [q])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-card)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95">
        <div className="flex items-center gap-3 border-b border-[var(--l-hairline)] px-4">
          <Search className="size-5 text-[var(--l-ink-tertiary)]" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for articles, guides, or keywords…"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--l-ink-tertiary)]"
          />
          <kbd className="rounded-md border border-[var(--l-hairline)] bg-[var(--l-chrome)] px-2 py-1 font-mono text-[11px] text-[var(--l-ink-subtle)]">Esc</kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-[var(--l-ink-subtle)]">
              No results for “{q}” — try different keywords, or <span className="font-medium text-primary">Contact support</span>.
            </div>
          ) : (
            results.map((a) => {
              const col = COLLECTIONS.find((c) => c.slug === a.collection)
              return (
                <button
                  key={a.slug}
                  onClick={() => onOpenArticle(a.slug)}
                  className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--l-hover)]"
                >
                  <FileText className="size-4 flex-none text-[var(--l-ink-tertiary)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{highlight(a.title, q)}</span>
                    <span className="block truncate text-[12.5px] text-[var(--l-ink-subtle)]">{highlight(a.excerpt, q)}</span>
                  </span>
                  {col && <span className="hidden flex-none rounded-md bg-[var(--l-chrome)] px-2 py-0.5 text-[11px] text-[var(--l-ink-subtle)] sm:block">{col.name}</span>}
                </button>
              )
            })
          )}
        </div>
        <div className="flex items-center gap-4 border-t border-[var(--l-hairline)] px-4 py-2.5 font-mono text-[11px] text-[var(--l-ink-tertiary)]">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}

function highlight(text: string, q: string): React.ReactNode {
  const t = q.trim()
  if (!t) return text
  const i = text.toLowerCase().indexOf(t.toLowerCase())
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-primary/20 text-inherit">{text.slice(i, i + t.length)}</mark>
      {text.slice(i + t.length)}
    </>
  )
}
