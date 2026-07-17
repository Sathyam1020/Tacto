import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { cn } from "@workspace/ui/lib/utils"

import { Prose } from "@/components/marketing/prose"
import { formatDate } from "@/lib/marketing/blog"
import { getLegalDoc, LEGAL_DOCS } from "@/lib/marketing/legal"
import { pageMeta } from "@/lib/marketing/seo"

type Params = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ slug: d.slug }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const doc = getLegalDoc(slug)
  if (!doc) return {}
  return pageMeta({ title: doc.title, description: doc.description, path: `/legal/${doc.slug}` })
}

export default async function LegalPage({ params }: Params) {
  const { slug } = await params
  const doc = getLegalDoc(slug)
  if (!doc) notFound()

  return (
    <section className="bg-white">
      <div className="mx-auto grid max-w-5xl gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[200px_1fr]">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="font-mono text-[11px] tracking-widest text-cobalt uppercase">Legal</p>
          <nav className="mt-4 flex flex-col gap-1">
            {LEGAL_DOCS.map((d) => (
              <Link
                key={d.slug}
                href={`/legal/${d.slug}`}
                aria-current={d.slug === doc.slug ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 text-[13.5px] transition-colors",
                  d.slug === doc.slug
                    ? "bg-primary/10 font-medium text-cobalt"
                    : "text-[var(--l-ink-subtle)] hover:bg-[var(--l-hover)] hover:text-[var(--l-ink)]"
                )}
              >
                {d.title}
              </Link>
            ))}
          </nav>
        </aside>

        <article className="min-w-0">
          <h1 className="font-display text-[34px] leading-tight font-semibold tracking-[-0.02em] text-[var(--l-ink)] sm:text-[40px]">
            {doc.title}
          </h1>
          <p className="mt-3 font-mono text-[12px] tracking-wide text-[var(--l-ink-tertiary)]">
            Last updated {formatDate(doc.updated)}
          </p>
          <div className="mt-8">
            <Prose>
              <doc.Body />
            </Prose>
          </div>
        </article>
      </div>
    </section>
  )
}
