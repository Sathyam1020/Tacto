"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { m } from "motion/react"
import {
  ArrowLeft,
  Check,
  ChevronRight,
  FileText,
  Globe,
  Headphones,
  Search,
  X,
} from "lucide-react"

import type {
  PublicHelpArticle,
  PublicHelpArticlePage,
  PublicHelpCenter,
  PublicHelpChrome,
  PublicHelpCollectionPage,
} from "@workspace/contracts/help-center"
import { Button } from "@workspace/ui/components/button"
import { DownloadIcon } from "@workspace/ui/components/download"
import { LogoMark } from "@workspace/ui/components/logo"
import { cn } from "@workspace/ui/lib/utils"

import { ViewModeToggle, type ViewMode } from "@/components/guide-view"
import { LanguageSwitcher, PublicGuideView } from "@/components/public-guide-view"
import { publicCollectionIcon } from "@/components/help/public-icon"
import { resolveCustomization } from "@/lib/guides"
import type { PublicGuide } from "@/lib/public-guide"
import { downloadGuidePdf } from "@/lib/pdf"

/** Force light mode on the public help center (the app defaults to a `.dark`
 *  class; the public reader is intentionally light-only). Restored on leave. */
function useForceLight() {
  React.useEffect(() => {
    const el = document.documentElement
    const wasDark = el.classList.contains("dark")
    el.classList.remove("dark")
    return () => {
      if (wasDark) el.classList.add("dark")
    }
  }, [])
}

/**
 * Brand-colored header + footer shell for the whole help center. Flex column so
 * the footer is always pinned to the bottom, even on short pages. Light-only.
 */
export function HelpChrome({
  chrome,
  onSearch,
  actions,
  children,
}: {
  chrome: PublicHelpChrome
  onSearch?: () => void
  /** Extra controls on the right of the navbar (e.g. the article reader controls). */
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  useForceLight()
  return (
    <div
      className="flex min-h-svh flex-col text-[var(--l-ink)]"
      style={{
        backgroundColor: "#FEFFFF",
        ...(chrome.brandColor ? { ["--primary" as string]: chrome.brandColor } : {}),
      } as React.CSSProperties}
    >
      <header className="sticky top-0 z-30 bg-primary text-primary-foreground">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
          <Link href={`/help/${chrome.slug}`} className="flex items-center gap-3">
            {chrome.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={chrome.logoUrl} alt={chrome.name} className="h-7 w-auto max-w-[160px] object-contain" />
            ) : (
              <span className="flex size-8 items-center justify-center rounded-lg bg-white/15">
                <LogoMark className="size-5" />
              </span>
            )}
            <span className="text-[15px] font-semibold">{chrome.name}</span>
          </Link>
          <nav className="hidden items-center gap-7 text-[13.5px] font-medium text-primary-foreground/80 md:flex">
            {chrome.navLinks.map((l) => (
              <a key={l.href} href={l.href} target={l.external ? "_blank" : undefined} rel={l.external ? "noreferrer" : undefined} className="transition-colors hover:text-primary-foreground">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {actions}
            {onSearch && (
              <button onClick={onSearch} aria-label="Search" className="flex size-9 items-center justify-center rounded-lg text-primary-foreground/80 transition-colors hover:bg-white/15 hover:text-primary-foreground">
                <Search className="size-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-[var(--l-hairline)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div className="flex items-center gap-2.5 text-xs text-[var(--l-ink-subtle)]">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <LogoMark className="size-4" />
            </span>
            <p className="font-semibold text-[var(--l-ink)]">{chrome.name}</p>
          </div>
          <div className="flex items-center gap-6 text-xs font-medium text-[var(--l-ink-subtle)]">
            {chrome.footerLinks.map((l) => (
              <a key={l.href} href={l.href} target={l.external ? "_blank" : undefined} rel={l.external ? "noreferrer" : undefined} className="hover:text-[var(--l-ink)]">
                {l.label}
              </a>
            ))}
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--l-hairline)] px-2.5 py-1.5 text-[var(--l-ink)]">
              <Globe className="size-3.5" /> English
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ── shared rows ─────────────────────────────────────────────────────────── */
function ArticleRow({ slug, article, divide }: { slug: string; article: PublicHelpArticle; divide?: boolean }) {
  return (
    <Link
      href={`/help/${slug}/${article.collectionSlug}/${article.slug}`}
      className={cn(
        "group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--l-hover)]",
        divide && "border-t border-[var(--l-hairline)]"
      )}
    >
      <span className="flex size-9 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
        <FileText className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold">{article.title}</span>
        {article.excerpt && <span className="mt-0.5 block truncate text-[13px] text-[var(--l-ink-subtle)]">{article.excerpt}</span>}
      </span>
      <span className="hidden flex-none text-xs text-[var(--l-ink-tertiary)] tabular-nums sm:block">{article.readMinutes} min read</span>
      <ChevronRight className="size-4 flex-none text-[var(--l-ink-tertiary)] transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  )
}

function Breadcrumb({ slug, trail }: { slug: string; trail: { label: string; href?: string }[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-[13px] text-[var(--l-ink-subtle)]">
      <Link href={`/help/${slug}`} className="inline-flex items-center gap-1 transition-colors hover:text-[var(--l-ink)]">
        <ArrowLeft className="size-3.5" /> Help Center
      </Link>
      {trail.map((t, i) => (
        <React.Fragment key={i}>
          <ChevronRight className="size-3.5 text-[var(--l-ink-tertiary)]" />
          {t.href ? (
            <Link href={t.href as never} className="transition-colors hover:text-[var(--l-ink)]">{t.label}</Link>
          ) : (
            <span className="truncate font-medium text-[var(--l-ink)]">{t.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}

/* ── home ────────────────────────────────────────────────────────────────── */
export function HelpHome({ data }: { data: PublicHelpCenter }) {
  const [searchOpen, setSearchOpen] = React.useState(false)
  const allArticles = React.useMemo(() => data.collections.flatMap((c) => c.articles), [data.collections])
  return (
    <HelpChrome chrome={data} onSearch={() => setSearchOpen(true)}>
      {/* brand hero band (continuous with the colored header) */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-3xl px-6 pb-10 pt-16 text-center">
          <h1 className="text-[34px] font-bold leading-tight tracking-tight text-balance sm:text-[40px]">{data.heroTitle}</h1>
          {data.heroSubtitle && <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-primary-foreground/80">{data.heroSubtitle}</p>}
          <button onClick={() => setSearchOpen(true)} className="group mx-auto mt-8 flex w-full items-center gap-3 rounded-2xl bg-[var(--l-card)] px-5 py-4 text-left shadow-[0_16px_40px_-16px_rgba(0,0,0,0.35)] transition-all hover:shadow-[0_20px_48px_-16px_rgba(0,0,0,0.45)]">
            <Search className="size-5 text-[var(--l-ink-tertiary)]" />
            <span className="flex-1 text-[15px] text-[var(--l-ink-tertiary)]">Search for articles, guides, or keywords…</span>
          </button>
        </div>
        <div className="mx-auto max-w-6xl px-6">
          <p className="pb-16 text-[13px] font-semibold tracking-wide text-primary-foreground/90">All Categories</p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-6 pb-16">
        {data.collections.length === 0 ? (
          <p className="-mt-10 rounded-2xl border border-dashed border-[var(--l-hairline-strong)] bg-[var(--l-card)] px-6 py-16 text-center text-sm text-[var(--l-ink-subtle)]">No articles published yet.</p>
        ) : (
          <div className="-mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.collections.map((c) => {
              const Icon = publicCollectionIcon(c.icon)
              return (
                <m.div key={c.slug} whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 320, damping: 26 }}>
                  <Link href={`/help/${data.slug}/${c.slug}`} className="group relative flex h-full flex-col rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-card)] p-6 shadow-[0_2px_8px_-4px_rgba(20,22,40,0.10)] transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-[var(--l-card-shadow)]">
                    <span className="absolute top-5 right-5 text-xs font-medium text-[var(--l-ink-tertiary)] tabular-nums">
                      {c.count} {c.count === 1 ? "article" : "articles"}
                    </span>
                    <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
                      <Icon className="size-5" />
                    </span>
                    <h3 className="mt-4 text-[17px] font-bold tracking-tight">{c.name}</h3>
                    {c.description && <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--l-ink-subtle)]">{c.description}</p>}
                  </Link>
                </m.div>
              )
            })}
          </div>
        )}

        {data.featured.length > 0 && (
          <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_320px]">
            <section>
              <h2 className="mb-4 text-lg font-semibold tracking-tight">Popular articles</h2>
              <div className="overflow-hidden rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-card)]">
                {data.featured.map((a, i) => (
                  <ArticleRow key={`${a.collectionSlug}/${a.slug}`} slug={data.slug} article={a} divide={i > 0} />
                ))}
              </div>
            </section>
            <aside className="flex flex-col gap-4">
              <div className="rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-card)] p-5">
                <h3 className="text-sm font-semibold">Still need help?</h3>
                <button className="mt-3 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-[var(--l-hover)]">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Headphones className="size-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-semibold">Contact Support</span><span className="block text-xs text-[var(--l-ink-subtle)]">Get help from our team</span></span>
                  <ChevronRight className="size-4 text-[var(--l-ink-tertiary)]" />
                </button>
              </div>
              {data.statusUrl && (
                <div className="rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-card)] p-5">
                  <h3 className="text-sm font-semibold">System Status</h3>
                  <a href={data.statusUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-[13px]">
                    <span className="flex size-5 items-center justify-center rounded-full bg-[var(--l-success)]/15 text-[var(--l-success)]"><Check className="size-3" strokeWidth={3} /></span>
                    View status page
                  </a>
                </div>
              )}
            </aside>
          </div>
        )}
      </main>

      {searchOpen && <SearchOverlay slug={data.slug} articles={allArticles} onClose={() => setSearchOpen(false)} />}
    </HelpChrome>
  )
}

/* ── collection (no sidebar — just the article list) ─────────────────────── */
export function HelpCollection({ page }: { page: PublicHelpCollectionPage }) {
  const { chrome, collection } = page
  const Icon = publicCollectionIcon(collection.icon)
  const [searchOpen, setSearchOpen] = React.useState(false)
  return (
    <HelpChrome chrome={chrome} onSearch={() => setSearchOpen(true)}>
      {searchOpen && <SearchOverlay slug={chrome.slug} articles={collection.articles} onClose={() => setSearchOpen(false)} />}
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Breadcrumb slug={chrome.slug} trail={[{ label: collection.name }]} />
        <div className="mt-6 flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-6" /></span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{collection.name}</h1>
            {collection.description && <p className="text-[13.5px] text-[var(--l-ink-subtle)]">{collection.description}</p>}
          </div>
        </div>
        {collection.articles.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-[var(--l-hairline-strong)] px-6 py-12 text-center text-sm text-[var(--l-ink-subtle)]">No articles in this collection yet.</p>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-card)]">
            {collection.articles.map((a, i) => (
              <ArticleRow key={a.slug} slug={chrome.slug} article={a} divide={i > 0} />
            ))}
          </div>
        )}
      </main>
    </HelpChrome>
  )
}

/* ── article (steps sidebar + Guide Reader, controls in the navbar) ──────── */
export function HelpArticle({ page, guide }: { page: PublicHelpArticlePage; guide: PublicGuide }) {
  const { chrome, collection, article, related } = page
  const [searchOpen, setSearchOpen] = React.useState(false)

  // Reader controls are lifted into the navbar; the reader is rendered
  // chromeless + controlled so the sidebar can react to the mode.
  const cust = React.useMemo(() => resolveCustomization(guide.customization), [guide.customization])
  const dv = cust.general.defaultView
  const lockedMode: ViewMode | null =
    dv === "only-scroll" ? "list" : dv === "only-walkthrough" ? "interactive" : null
  const [mode, setMode] = React.useState<ViewMode>(
    dv === "walkthrough-default" || dv === "only-walkthrough" ? "interactive" : "list"
  )
  const effectiveMode = lockedMode ?? mode
  const [lang, setLang] = React.useState<string | null>(null)
  const translations = guide.translations ?? []

  const steps = React.useMemo(
    () =>
      guide.blocks
        .filter((b) => b.type === "STEP")
        .map((b, i) => ({ key: b.key, n: i + 1, label: stripHtml(b.content) })),
    [guide.blocks]
  )

  const controls = (
    <div className="flex items-center gap-1.5 rounded-xl bg-[var(--l-card)] p-1 shadow-sm">
      {translations.length > 0 && (
        <LanguageSwitcher translations={translations} value={lang} onChange={setLang} />
      )}
      {!lockedMode && <ViewModeToggle mode={mode} onChange={setMode} />}
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          void downloadGuidePdf({
            title: guide.title,
            summary: guide.summary,
            blocks: guide.blocks,
            customization: guide.customization,
          })
        }
      >
        <DownloadIcon size={15} />
        PDF
      </Button>
    </div>
  )

  const showSidebar = effectiveMode === "list" && steps.length > 0

  return (
    <HelpChrome chrome={chrome} actions={controls} onSearch={() => setSearchOpen(true)}>
      {searchOpen && <SearchOverlay slug={chrome.slug} articles={related} onClose={() => setSearchOpen(false)} />}
      {/* Full-bleed: sidebar hugs the viewport left, content fills the rest. */}
      <div className="flex">
        {showSidebar && <StepsSidebar steps={steps} />}
        <div className="min-w-0 flex-1">
          <div className="mx-auto max-w-3xl px-6 pt-6">
            <Breadcrumb
              slug={chrome.slug}
              trail={[
                { label: collection.name, href: `/help/${chrome.slug}/${collection.slug}` },
                { label: article.title },
              ]}
            />
          </div>
          <PublicGuideView guide={guide} chromeless mode={mode} lang={lang} stepVariant="cards" />
          {related.length > 0 && (
            <div className="mx-auto max-w-3xl px-6 pb-16">
              <h2 className="mb-3 text-sm font-semibold">Related articles</h2>
              <div className="overflow-hidden rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-card)]">
                {related.map((a, i) => (
                  <ArticleRow key={a.slug} slug={chrome.slug} article={a} divide={i > 0} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </HelpChrome>
  )
}

function StepsSidebar({ steps }: { steps: { key: string; n: number; label: string }[] }) {
  const go = (key: string) => {
    document.querySelector(`[data-step-key="${key}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }
  return (
    <aside className="sticky top-16 hidden h-[calc(100svh-4rem)] w-80 shrink-0 self-start overflow-y-auto border-r border-[var(--l-hairline)] bg-[var(--l-card)] lg:block">
      <div className="sticky top-0 z-10 border-b border-[var(--l-hairline)] bg-[var(--l-chrome)] px-6 py-4">
        <p className="text-[15px] font-semibold">Steps</p>
      </div>
      <ol className="flex flex-col">
        {steps.map((s) => (
          <li key={s.key} className="border-b border-[var(--l-hairline)]">
            <button
              onClick={() => go(s.key)}
              className="flex w-full gap-2 px-6 py-4 text-left text-[13.5px] leading-relaxed text-[var(--l-ink-subtle)] transition-colors hover:bg-[var(--l-hover)] hover:text-[var(--l-ink)]"
            >
              <span className="font-semibold text-[var(--l-ink)]">{s.n}.</span>
              <span className="line-clamp-3">{s.label}</span>
            </button>
          </li>
        ))}
      </ol>
    </aside>
  )
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

/* ── search overlay ──────────────────────────────────────────────────────── */
function SearchOverlay({ slug, articles, onClose }: { slug: string; articles: PublicHelpArticle[]; onClose: () => void }) {
  const [q, setQ] = React.useState("")
  const router = useRouter()
  const results = React.useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return articles.slice(0, 6)
    return articles.filter((a) => (a.title + (a.excerpt ?? "")).toLowerCase().includes(t)).slice(0, 20)
  }, [q, articles])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-card)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95">
        <div className="flex items-center gap-3 border-b border-[var(--l-hairline)] px-4">
          <Search className="size-5 text-[var(--l-ink-tertiary)]" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search articles…" className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--l-ink-tertiary)]" />
          <button onClick={onClose} className="flex size-7 items-center justify-center rounded-md text-[var(--l-ink-tertiary)] hover:bg-[var(--l-hover)]"><X className="size-4" /></button>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-[var(--l-ink-subtle)]">No results for “{q}”.</div>
          ) : (
            results.map((a) => (
              <button
                key={`${a.collectionSlug}/${a.slug}`}
                onClick={() => {
                  onClose()
                  router.push(`/help/${slug}/${a.collectionSlug}/${a.slug}`)
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--l-hover)]"
              >
                <FileText className="size-4 flex-none text-[var(--l-ink-tertiary)]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{highlight(a.title, q)}</span>
                  {a.excerpt && <span className="block truncate text-[12.5px] text-[var(--l-ink-subtle)]">{a.excerpt}</span>}
                </span>
              </button>
            ))
          )}
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
