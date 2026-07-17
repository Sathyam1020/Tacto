import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, LifeBuoy, Mail, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react"

import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { Item, Reveal, StaggerReveal } from "@/components/marketing/motion"
import { PageHero } from "@/components/marketing/page-hero"
import { pageMeta } from "@/lib/marketing/seo"

export const metadata: Metadata = pageMeta({
  title: "Contact",
  description: "Get in touch with Tacto — sales, support, security, and press. We read every message.",
  path: "/contact",
})

const CHANNELS: { icon: LucideIcon; title: string; body: string; email: string }[] = [
  { icon: Sparkles, title: "Sales", body: "Team plans, Enterprise, volume pricing, and demos for 20+ seats.", email: "sales@tacto.fyi" },
  { icon: LifeBuoy, title: "Support", body: "Trouble with a guide, a capture, or your account? We'll help.", email: "support@tacto.fyi" },
  { icon: ShieldCheck, title: "Security", body: "Report a vulnerability or request our security documentation.", email: "security@tacto.fyi" },
  { icon: Mail, title: "Press & partnerships", body: "Media requests, partnerships, and everything else.", email: "hello@tacto.fyi" },
]

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Contact" title="Talk to us." subtitle="Whatever you need, there's a real person on the other end." />
      <section className="bg-white">
        <div className="mx-auto max-w-5xl px-5 py-20 sm:px-8 sm:py-24">
          <StaggerReveal className="grid gap-5 sm:grid-cols-2">
            {CHANNELS.map((c) => (
              <Item key={c.title}>
                <a
                  href={`mailto:${c.email}`}
                  className="group flex h-full flex-col rounded-3xl border border-[var(--l-hairline)] bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(20,23,40,0.3)]"
                >
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-cobalt">
                    <c.icon className="size-6" />
                  </span>
                  <h2 className="mt-5 font-display text-lg font-semibold tracking-tight text-[var(--l-ink)]">{c.title}</h2>
                  <p className="mt-2 flex-1 text-[14.5px] leading-relaxed text-[var(--l-ink-subtle)]">{c.body}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 font-mono text-[13px] font-medium text-cobalt">
                    {c.email}
                    <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </a>
              </Item>
            ))}
          </StaggerReveal>

          <Reveal delay={0.1} className="mt-12">
            <div className="flex flex-col items-center gap-5 rounded-3xl border border-[var(--l-hairline)] bg-[var(--l-canvas)] p-10 text-center">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-[var(--l-ink)]">
                Prefer to just try it?
              </h2>
              <p className="max-w-md text-[15px] text-[var(--l-ink-subtle)]">
                The fastest way to see what Tacto does is to record your first guide. It's free, and it takes about a
                minute.
              </p>
              <Link href="/sign-up" className={cn(buttonVariants(), "gap-1.5")}>
                Start for free <ArrowRight className="size-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
