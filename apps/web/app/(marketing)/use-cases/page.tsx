import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Cta } from "@/components/marketing/cta"
import { Item, StaggerReveal } from "@/components/marketing/motion"
import { PageHero } from "@/components/marketing/page-hero"
import { USE_CASES } from "@/lib/marketing/use-cases"
import { pageMeta } from "@/lib/marketing/seo"

export const metadata: Metadata = pageMeta({
  title: "Use cases",
  description:
    "One capture tool, every kind of documentation — onboarding, customer support, SOPs, product marketing, IT, and training. See how teams use Tacto.",
  path: "/use-cases",
})

export default function UseCasesHub() {
  return (
    <>
      <PageHero
        eyebrow="Use cases"
        title="One capture tool, every kind of documentation."
        subtitle="Built for more than one job."
      />
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <StaggerReveal className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {USE_CASES.map((u) => (
              <Item key={u.slug}>
                <Link
                  href={`/use-cases/${u.slug}`}
                  className="group flex h-full flex-col rounded-3xl border border-[var(--l-hairline)] bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_60px_-30px_rgba(20,23,40,0.35)]"
                >
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-cobalt transition-transform duration-300 group-hover:scale-105">
                    <u.icon className="size-6" />
                  </span>
                  <h2 className="mt-5 font-display text-xl font-semibold tracking-tight text-[var(--l-ink)]">{u.label}</h2>
                  <p className="mt-2 flex-1 text-[14.5px] leading-relaxed text-[var(--l-ink-subtle)]">{u.subtitle}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-cobalt">
                    Learn more
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
