import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, Check } from "lucide-react"

import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { Cta } from "@/components/marketing/cta"
import { FaqAccordion } from "@/components/marketing/faq-accordion"
import { Item, Reveal, StaggerReveal } from "@/components/marketing/motion"
import { PageHero } from "@/components/marketing/page-hero"
import { getUseCase, USE_CASES } from "@/lib/marketing/use-cases"
import { breadcrumbJsonLd, faqPageJsonLd, jsonLd, pageMeta } from "@/lib/marketing/seo"

type Params = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return USE_CASES.map((u) => ({ slug: u.slug }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const uc = getUseCase(slug)
  if (!uc) return {}
  return pageMeta({ title: uc.label, description: uc.description, path: `/use-cases/${uc.slug}` })
}

export default async function UseCasePage({ params }: Params) {
  const { slug } = await params
  const uc = getUseCase(slug)
  if (!uc) notFound()

  const others = USE_CASES.filter((u) => u.slug !== uc.slug)
  const schema = [
    faqPageJsonLd(uc.faqs),
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Use cases", path: "/use-cases" },
      { name: uc.label, path: `/use-cases/${uc.slug}` },
    ]),
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
      <PageHero eyebrow="Use case" title={uc.title} subtitle={uc.subtitle}>
        <Link href="/sign-up" className={cn(buttonVariants(), "gap-1.5")}>
          Start for free <ArrowRight className="size-4" />
        </Link>
        <Link href="/pricing" className={cn(buttonVariants({ variant: "outline" }))}>
          See pricing
        </Link>
      </PageHero>

      {/* Intro + the problem */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8 sm:py-24">
          <Reveal>
            <p className="text-[18px] leading-[1.7] text-[var(--l-ink-subtle)]">{uc.intro}</p>
          </Reveal>
          <Reveal delay={0.1} className="mt-12">
            <p className="font-mono text-[11px] tracking-widest text-cobalt uppercase">The problem</p>
            <ul className="mt-5 flex flex-col gap-3">
              {uc.pains.map((p) => (
                <li key={p} className="flex items-start gap-3 text-[15.5px] leading-relaxed text-[var(--l-ink)]">
                  <span aria-hidden className="mt-2 size-1.5 flex-none rounded-full bg-[var(--l-ink-tertiary)]" />
                  {p}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* How Tacto helps */}
      <section className="border-y border-[var(--l-hairline)] bg-[var(--l-canvas)]">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-28">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-[11px] tracking-widest text-cobalt uppercase">How Tacto helps</p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.02em] text-[var(--l-ink)] sm:text-4xl">
              Built for exactly this.
            </h2>
          </Reveal>
          <StaggerReveal className="mt-14 grid gap-5 md:grid-cols-3">
            {uc.capabilities.map((c) => (
              <Item key={c.title}>
                <div className="flex h-full flex-col rounded-3xl border border-[var(--l-hairline)] bg-white p-7 shadow-sm">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-cobalt">
                    <c.icon className="size-6" />
                  </span>
                  <h3 className="mt-5 font-display text-lg font-semibold tracking-tight text-[var(--l-ink)]">{c.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--l-ink-subtle)]">{c.body}</p>
                </div>
              </Item>
            ))}
          </StaggerReveal>
        </div>
      </section>

      {/* Outcomes */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-5 py-24 sm:px-8">
          <Reveal className="text-center">
            <p className="font-mono text-[11px] tracking-widest text-cobalt uppercase">What changes</p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.02em] text-[var(--l-ink)] sm:text-4xl">
              The outcome.
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="mx-auto mt-10 max-w-xl">
            <ul className="flex flex-col gap-4">
              {uc.outcomes.map((o) => (
                <li key={o} className="flex items-start gap-3 text-[16px] leading-relaxed text-[var(--l-ink)]">
                  <Check className="mt-0.5 size-5 flex-none text-cobalt" strokeWidth={2.5} />
                  {o}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-[var(--l-hairline)] bg-[var(--l-canvas)]">
        <div className="mx-auto max-w-3xl px-5 py-24 sm:px-8">
          <Reveal className="text-center">
            <p className="font-mono text-[11px] tracking-widest text-cobalt uppercase">FAQ</p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.02em] text-[var(--l-ink)] sm:text-4xl">
              Good to know.
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="mt-10">
            <FaqAccordion items={uc.faqs.map((f) => ({ q: f.q, a: f.a }))} />
          </Reveal>
        </div>
      </section>

      {/* Other use cases */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <p className="font-mono text-[11px] tracking-widest text-cobalt uppercase">More use cases</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((o) => (
              <Link
                key={o.slug}
                href={`/use-cases/${o.slug}`}
                className="group flex items-center gap-3 rounded-2xl border border-[var(--l-hairline)] bg-white p-4 transition-colors hover:bg-[var(--l-hover)]"
              >
                <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-primary/10 text-cobalt">
                  <o.icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1 text-[14px] font-medium text-[var(--l-ink)]">{o.label}</span>
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
