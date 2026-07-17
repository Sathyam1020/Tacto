import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Cta } from "@/components/marketing/cta"
import { Item, StaggerReveal } from "@/components/marketing/motion"
import { PageHero } from "@/components/marketing/page-hero"
import { COMPARISONS } from "@/lib/marketing/compare"
import { pageMeta } from "@/lib/marketing/seo"

export const metadata: Metadata = pageMeta({
  title: "Compare Tacto",
  description:
    "How Tacto compares to Scribe, Guidejar, Supademo, Tango, and Arcade — fair, side-by-side comparisons of interactive guides, help centers, AI, and analytics.",
  path: "/compare",
})

export default function CompareHub() {
  return (
    <>
      <PageHero
        eyebrow="Compare"
        title="How Tacto stacks up."
        subtitle="Fair, side-by-side comparisons — including where the others shine."
      />
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <StaggerReveal className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {COMPARISONS.map((c) => (
              <Item key={c.slug}>
                <Link
                  href={`/compare/${c.slug}`}
                  className="group flex h-full flex-col rounded-3xl border border-[var(--l-hairline)] bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_60px_-30px_rgba(20,23,40,0.35)]"
                >
                  <h2 className="font-display text-xl font-semibold tracking-tight text-[var(--l-ink)]">
                    Tacto vs {c.name}
                  </h2>
                  <p className="mt-2 flex-1 text-[14.5px] leading-relaxed text-[var(--l-ink-subtle)]">{c.subtitle}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-cobalt">
                    Compare
                    <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </Link>
              </Item>
            ))}
          </StaggerReveal>
        </div>
      </section>
      <Cta />
    </>
  )
}
