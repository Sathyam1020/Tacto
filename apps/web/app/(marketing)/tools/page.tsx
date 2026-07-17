import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Cta } from "@/components/marketing/cta"
import { Item, StaggerReveal } from "@/components/marketing/motion"
import { PageHero } from "@/components/marketing/page-hero"
import { TOOLS } from "@/lib/marketing/tools"
import { pageMeta } from "@/lib/marketing/seo"

export const metadata: Metadata = pageMeta({
  title: "Free tools",
  description:
    "A suite of free, browser-based tools from Tacto: screen recorder, screenshot annotator, GIF maker, QR code generator, SOP creator, and a step-by-step guide maker.",
  path: "/tools",
})

export default function ToolsHub() {
  return (
    <>
      <PageHero eyebrow="Free tools" title="Small tools, no sign-up." subtitle="Handy, browser-based utilities — free to use." />
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <StaggerReveal className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((t) => (
              <Item key={t.slug}>
                <Link
                  href={`/tools/${t.slug}`}
                  className="group flex h-full flex-col rounded-3xl border border-[var(--l-hairline)] bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_60px_-30px_rgba(20,23,40,0.35)]"
                >
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-cobalt transition-transform duration-300 group-hover:scale-105">
                    <t.icon className="size-6" />
                  </span>
                  <h2 className="mt-5 font-display text-lg font-semibold tracking-tight text-[var(--l-ink)]">{t.name}</h2>
                  <p className="mt-2 flex-1 text-[14.5px] leading-relaxed text-[var(--l-ink-subtle)]">{t.tagline}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-cobalt">
                    Open tool <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
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
