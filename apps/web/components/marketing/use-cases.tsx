import Link from "next/link"
import { ArrowRight, GraduationCap, LifeBuoy, Megaphone, ScrollText } from "lucide-react"

import { Item, Reveal, StaggerReveal } from "@/components/marketing/motion"

/**
 * Use cases — four flagship jobs, as large cards with a designed on-brand
 * gradient-art header (no stock illustrations, no gray boxes). Server-rendered;
 * only the reveal wrappers hydrate. Cards deep-link to /use-cases/{slug} for the
 * programmatic-SEO pages (RFC phase-17).
 */
const CASES = [
  {
    icon: GraduationCap,
    title: "Employee onboarding",
    body: "Turn tribal knowledge into a self-serve path new hires can follow on day one — no shadowing, no repeated demos.",
    href: "/use-cases/onboarding",
  },
  {
    icon: LifeBuoy,
    title: "Customer support",
    body: "Answer “how do I…?” with a guide that resolves the question before a ticket is ever filed. Fewer tickets, faster answers.",
    href: "/use-cases/support",
  },
  {
    icon: ScrollText,
    title: "SOPs & documentation",
    body: "Capture how work actually gets done — once — and keep it current without a rewrite every time the UI changes.",
    href: "/use-cases/sops",
  },
  {
    icon: Megaphone,
    title: "Product marketing",
    body: "Ship interactive demos that let buyers try the product themselves, at their own pace, before they ever book a call.",
    href: "/use-cases/product-marketing",
  },
]

export function UseCases() {
  return (
    <section id="use-cases" className="scroll-mt-20 bg-white">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-[11px] tracking-widest text-cobalt uppercase">Use cases</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.02em] text-balance text-[var(--l-ink)] sm:text-5xl">
            One capture tool, every kind of documentation.
          </h2>
          <p className="mt-4 font-accent text-[21px] text-[var(--l-ink-subtle)] sm:text-[24px]">
            Built for more than one job.
          </p>
        </Reveal>

        <StaggerReveal className="mt-14 grid gap-5 sm:grid-cols-2">
          {CASES.map((c) => (
            <Item key={c.title}>
            <Link
              href={c.href}
              className="group flex h-full flex-col overflow-hidden rounded-3xl border border-[var(--l-hairline)] bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_60px_-30px_rgba(20,23,40,0.35)]"
            >
              {/* designed gradient-art header */}
              <div className="relative flex h-36 items-center justify-center overflow-hidden bg-gradient-to-br from-primary/14 via-primary/6 to-transparent">
                <div aria-hidden className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(var(--cobalt) 1px, transparent 1px)", backgroundSize: "22px 22px", maskImage: "radial-gradient(60% 100% at 50% 0%, #000, transparent)" }} />
                <c.icon aria-hidden className="absolute -right-4 -bottom-5 size-32 text-cobalt/10" strokeWidth={1.25} />
                <span className="relative flex size-14 items-center justify-center rounded-2xl bg-white text-cobalt shadow-md transition-transform duration-300 group-hover:scale-105">
                  <c.icon className="size-7" />
                </span>
              </div>
              <div className="p-7">
                <h3 className="font-display text-xl font-semibold tracking-tight text-[var(--l-ink)]">{c.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--l-ink-subtle)]">{c.body}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-cobalt">
                  Learn more
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
            </Item>
          ))}
        </StaggerReveal>
      </div>
    </section>
  )
}
