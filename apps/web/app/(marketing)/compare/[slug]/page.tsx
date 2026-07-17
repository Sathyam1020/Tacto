import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, Check, Minus } from "lucide-react"

import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { Cta } from "@/components/marketing/cta"
import { FaqAccordion } from "@/components/marketing/faq-accordion"
import { Item, Reveal, StaggerReveal } from "@/components/marketing/motion"
import { PageHero } from "@/components/marketing/page-hero"
import { COMPARISONS, getComparison } from "@/lib/marketing/compare"
import { jsonLd, pageMeta } from "@/lib/marketing/seo"

type Params = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const c = getComparison(slug)
  if (!c) return {}
  return pageMeta({ title: c.title, description: c.description, path: `/compare/${c.slug}` })
}

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="mx-auto size-4 text-cobalt" strokeWidth={2.5} />
  if (value === false) return <Minus className="mx-auto size-4 text-[var(--l-ink-tertiary)]/50" />
  return <span className="text-[12.5px] font-medium text-[var(--l-ink-subtle)]">{value}</span>
}

export default async function ComparePage({ params }: Params) {
  const { slug } = await params
  const c = getComparison(slug)
  if (!c) notFound()

  const others = COMPARISONS.filter((x) => x.slug !== c.slug)
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
      <PageHero eyebrow="Compare" title={c.title} subtitle={c.subtitle}>
        <Link href="/sign-up" className={cn(buttonVariants(), "gap-1.5")}>
          Start for free <ArrowRight className="size-4" />
        </Link>
        <Link href="/pricing" className={cn(buttonVariants({ variant: "outline" }))}>
          See pricing
        </Link>
      </PageHero>

      {/* Intro + at-a-glance table */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8 sm:py-24">
          <Reveal>
            <p className="text-[18px] leading-[1.7] text-[var(--l-ink-subtle)]">{c.intro}</p>
          </Reveal>

          <Reveal delay={0.1} className="mt-12">
            <div className="overflow-hidden rounded-2xl border border-[var(--l-hairline)]">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-[var(--l-canvas)]">
                    <th className="px-4 py-3 text-[13px] font-medium text-[var(--l-ink-subtle)]">Feature</th>
                    <th className="px-3 py-3 text-center font-display text-[14px] font-semibold text-cobalt">Tacto</th>
                    <th className="px-3 py-3 text-center font-display text-[14px] font-semibold text-[var(--l-ink)]">{c.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {c.rows.map((row) => (
                    <tr key={row.feature} className="border-t border-[var(--l-hairline)]/70">
                      <td className="px-4 py-3 text-[13.5px] text-[var(--l-ink)]">{row.feature}</td>
                      <td className="px-3 py-3 text-center">
                        <Cell value={row.tacto} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Cell value={row.them} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[12px] text-[var(--l-ink-tertiary)]">
              Comparison based on publicly available information as of 2026. Products change often — check {c.name}&apos;s
              site for the latest.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Why Tacto */}
      <section className="border-y border-[var(--l-hairline)] bg-[var(--l-canvas)]">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-28">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-[11px] tracking-widest text-cobalt uppercase">Why Tacto</p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.02em] text-[var(--l-ink)] sm:text-4xl">
              Why teams choose Tacto over {c.name}.
            </h2>
          </Reveal>
          <StaggerReveal className="mt-14 grid gap-5 md:grid-cols-3">
            {c.advantages.map((a) => (
              <Item key={a.title}>
                <div className="flex h-full flex-col rounded-3xl border border-[var(--l-hairline)] bg-white p-7 shadow-sm">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-cobalt">
                    <Check className="size-6" strokeWidth={2.5} />
                  </span>
                  <h3 className="mt-5 font-display text-lg font-semibold tracking-tight text-[var(--l-ink)]">{a.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--l-ink-subtle)]">{a.body}</p>
                </div>
              </Item>
            ))}
          </StaggerReveal>

          {/* Honest note */}
          <Reveal delay={0.1} className="mx-auto mt-10 max-w-2xl">
            <div className="rounded-2xl border border-[var(--l-hairline)] bg-white p-6 text-center">
              <p className="font-mono text-[11px] tracking-widest text-[var(--l-ink-tertiary)] uppercase">Being fair</p>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--l-ink-subtle)]">{c.theirStrength}</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-5 py-24 sm:px-8">
          <Reveal className="text-center">
            <p className="font-mono text-[11px] tracking-widest text-cobalt uppercase">FAQ</p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.02em] text-[var(--l-ink)] sm:text-4xl">
              Questions, answered.
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="mt-10">
            <FaqAccordion items={c.faqs.map((f) => ({ q: f.q, a: f.a }))} />
          </Reveal>
        </div>
      </section>

      {/* Other comparisons */}
      <section className="border-t border-[var(--l-hairline)] bg-[var(--l-canvas)]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <p className="font-mono text-[11px] tracking-widest text-cobalt uppercase">More comparisons</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {others.map((o) => (
              <Link
                key={o.slug}
                href={`/compare/${o.slug}`}
                className="group flex items-center justify-between gap-2 rounded-2xl border border-[var(--l-hairline)] bg-white px-4 py-3.5 text-[14px] font-medium text-[var(--l-ink)] transition-colors hover:bg-[var(--l-hover)]"
              >
                Tacto vs {o.name}
                <ArrowRight className="size-4 flex-none text-[var(--l-ink-tertiary)] transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Cta />
    </>
  )
}
