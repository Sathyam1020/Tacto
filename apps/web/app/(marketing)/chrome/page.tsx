import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Check, MousePointerClick, Sparkles, Zap } from "lucide-react"

import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { Cta } from "@/components/marketing/cta"
import { Item, Reveal, StaggerReveal } from "@/components/marketing/motion"
import { PageHero } from "@/components/marketing/page-hero"
import { pageMeta } from "@/lib/marketing/seo"

export const metadata: Metadata = pageMeta({
  title: "Chrome extension",
  description:
    "Record any browser workflow with the Tacto Chrome extension. Click through a process once and Tacto turns it into a step-by-step guide automatically.",
  path: "/chrome",
})

const STEPS = [
  { icon: Zap, title: "Add it to Chrome", body: "Install the extension and connect it to your Tacto workspace in one click." },
  { icon: MousePointerClick, title: "Record your workflow", body: "Hit record and do the task the way you normally would. Every click is captured." },
  { icon: Sparkles, title: "Get a guide, instantly", body: "Stop recording and Tacto writes the steps, marks the clicks, and publishes the guide." },
]

const POINTS = [
  "Captures every click, field, and page change automatically",
  "Marks the exact click on each screenshot",
  "Turns one recording into a guide, walkthrough, and PDF",
  "Redact sensitive data before you share",
]

export default function ChromePage() {
  return (
    <>
      <PageHero eyebrow="Chrome extension" title="Record it in the browser you already use." subtitle="Click through a workflow once. Tacto documents it.">
        <Link href="/sign-up" className={cn(buttonVariants(), "gap-1.5")}>
          Add Tacto to Chrome <ArrowRight className="size-4" />
        </Link>
        <Link href="/features" className={cn(buttonVariants({ variant: "outline" }))}>
          See what it captures
        </Link>
      </PageHero>

      {/* How it works */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <Reveal className="text-center">
            <p className="font-mono text-[11px] tracking-widest text-cobalt uppercase">How it works</p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.02em] text-[var(--l-ink)] sm:text-4xl">
              Three steps, about a minute.
            </h2>
          </Reveal>
          <StaggerReveal className="mt-14 grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Item key={s.title}>
                <div className="flex h-full flex-col rounded-3xl border border-[var(--l-hairline)] bg-white p-7 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-cobalt">
                      <s.icon className="size-6" />
                    </span>
                    <span className="font-mono text-[13px] text-[var(--l-ink-tertiary)]">0{i + 1}</span>
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold tracking-tight text-[var(--l-ink)]">{s.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--l-ink-subtle)]">{s.body}</p>
                </div>
              </Item>
            ))}
          </StaggerReveal>
        </div>
      </section>

      {/* Points */}
      <section className="border-y border-[var(--l-hairline)] bg-[var(--l-canvas)]">
        <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
          <Reveal>
            <ul className="grid gap-4 sm:grid-cols-2">
              {POINTS.map((p) => (
                <li key={p} className="flex items-start gap-3 text-[15px] leading-relaxed text-[var(--l-ink)]">
                  <Check className="mt-0.5 size-5 flex-none text-cobalt" strokeWidth={2.5} />
                  {p}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <Cta />
    </>
  )
}
