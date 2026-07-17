import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  BookOpen,
  Code2,
  MousePointerClick,
  Rocket,
  Share2,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react"

import { Cta } from "@/components/marketing/cta"
import { Item, StaggerReveal } from "@/components/marketing/motion"
import { PageHero } from "@/components/marketing/page-hero"
import { pageMeta } from "@/lib/marketing/seo"

export const metadata: Metadata = pageMeta({
  title: "Docs",
  description: "Documentation for Tacto — getting started, recording, editing, sharing, embedding, and the help center.",
  path: "/docs",
})

const TOPICS: { icon: LucideIcon; title: string; body: string; href: string }[] = [
  { icon: Rocket, title: "Getting started", body: "Install the extension, record your first workflow, and publish a guide in about a minute.", href: "/sign-up" },
  { icon: MousePointerClick, title: "Recording", body: "How capture works, what gets captured, and tips for a clean recording.", href: "/chrome" },
  { icon: SlidersHorizontal, title: "Editing & customization", body: "Edit steps, apply your branding, add narration, and translate a guide.", href: "/features" },
  { icon: Share2, title: "Sharing & embedding", body: "Share by link, embed anywhere, and choose list or interactive mode.", href: "/features" },
  { icon: BookOpen, title: "Help center", body: "Group guides into a searchable, branded knowledge base on your domain.", href: "/help" },
  { icon: Code2, title: "Extension & setup", body: "Connect the browser extension to your workspace and manage capture settings.", href: "/chrome" },
]

export default function DocsPage() {
  return (
    <>
      <PageHero eyebrow="Docs" title="Everything, documented." subtitle="Start here, and find your way around Tacto." />
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <StaggerReveal className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {TOPICS.map((t) => (
              <Item key={t.title}>
                <Link
                  href={t.href}
                  className="group flex h-full flex-col rounded-3xl border border-[var(--l-hairline)] bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(20,23,40,0.3)]"
                >
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-cobalt">
                    <t.icon className="size-6" />
                  </span>
                  <h2 className="mt-5 font-display text-lg font-semibold tracking-tight text-[var(--l-ink)]">{t.title}</h2>
                  <p className="mt-2 flex-1 text-[14.5px] leading-relaxed text-[var(--l-ink-subtle)]">{t.body}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-cobalt">
                    Open <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
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
