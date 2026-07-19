import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  FileText,
  LayoutGrid,
  LifeBuoy,
  MousePointerClick,
  type LucideIcon,
} from "lucide-react"

import { Cta } from "@/components/marketing/cta"
import { Item, StaggerReveal } from "@/components/marketing/motion"
import { PageHero } from "@/components/marketing/page-hero"
import { pageMeta } from "@/lib/marketing/seo"

export const metadata: Metadata = pageMeta({
  title: "Solutions — SOPs, onboarding, support & product demos",
  description:
    "From step-by-step guides to interactive walkthroughs, showcases, help centers, forms, and analytics — the ways teams turn one recording into everything they need.",
  path: "/solutions",
})

const SOLUTIONS: { icon: LucideIcon; title: string; body: string; href: string }[] = [
  { icon: FileText, title: "Step-by-step guides", body: "Record once; AI writes a clear step for every click, with the screenshot to match. Share by link or embed anywhere.", href: "/features" },
  { icon: MousePointerClick, title: "Interactive walkthroughs", body: "Spotlighted, click-through demos viewers drive themselves — the format that makes a product feel real.", href: "/#demo" },
  { icon: LayoutGrid, title: "Showcases", body: "Curate guides into branded, embeddable collections for onboarding flows and demo galleries.", href: "/features" },
  { icon: LifeBuoy, title: "Help center", body: "A searchable knowledge base on your own domain, so customers self-serve before they open a ticket.", href: "/use-cases/support" },
  { icon: ClipboardList, title: "Forms", body: "Collect answers inside a guide — qualify a lead or gather feedback without breaking the flow.", href: "/features" },
  { icon: BarChart3, title: "Analytics", body: "Views, completion, and drop-off per guide, so you improve the docs that actually move the needle.", href: "/features" },
]

export default function SolutionsPage() {
  return (
    <>
      <PageHero
        eyebrow="Solutions"
        title="One recording. Everything you need."
        subtitle="Guides, demos, help centers, and more — from a single capture."
      />
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <StaggerReveal className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SOLUTIONS.map((s) => (
              <Item key={s.title}>
                <Link
                  href={s.href}
                  className="group flex h-full flex-col rounded-3xl border border-[var(--l-hairline)] bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_60px_-30px_rgba(20,23,40,0.35)]"
                >
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-cobalt transition-transform duration-300 group-hover:scale-105">
                    <s.icon className="size-6" />
                  </span>
                  <h2 className="mt-5 font-display text-lg font-semibold tracking-tight text-[var(--l-ink)]">{s.title}</h2>
                  <p className="mt-2 flex-1 text-[14.5px] leading-relaxed text-[var(--l-ink-subtle)]">{s.body}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-cobalt">
                    Explore <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
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
