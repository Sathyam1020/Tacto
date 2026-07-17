import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { PageHero } from "@/components/marketing/page-hero"
import { TOOLS, type Tool } from "@/lib/marketing/tools"

/**
 * Shared chrome for a free-tool page: the hero, the tool UI (children), a
 * cross-link strip to the other tools, and a soft funnel to the product. Keeps
 * every tool page consistent so the set reads as one polished suite.
 */
export function ToolShell({ tool, children }: { tool: Tool; children: React.ReactNode }) {
  const others = TOOLS.filter((t) => t.slug !== tool.slug).slice(0, 5)
  return (
    <>
      <PageHero eyebrow="Free tool" title={tool.name} subtitle={tool.tagline} />

      <section className="bg-white">
        <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-16">{children}</div>
      </section>

      {/* Funnel */}
      <section className="border-y border-[var(--l-hairline)] bg-[var(--l-canvas)]">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-5 py-16 text-center sm:px-8">
          <p className="font-mono text-[11px] tracking-widest text-cobalt uppercase">From the makers of Tacto</p>
          <h2 className="max-w-xl font-display text-2xl font-semibold tracking-tight text-[var(--l-ink)] sm:text-3xl">
            Documenting a whole workflow? Let Tacto do it.
          </h2>
          <p className="max-w-md text-[15px] text-[var(--l-ink-subtle)]">
            Record once and get a step-by-step guide, an interactive walkthrough, and a help center — automatically.
          </p>
          <Link
            href="/sign-up"
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-[14px] font-semibold text-white transition-transform hover:scale-[1.02]"
          >
            Start for free <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* Other tools */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <p className="font-mono text-[11px] tracking-widest text-cobalt uppercase">More free tools</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((t) => (
              <Link
                key={t.slug}
                href={`/tools/${t.slug}`}
                className="group flex items-center gap-3 rounded-2xl border border-[var(--l-hairline)] bg-white p-4 transition-colors hover:bg-[var(--l-hover)]"
              >
                <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-primary/10 text-cobalt">
                  <t.icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1 text-[14px] font-medium text-[var(--l-ink)]">{t.name}</span>
                <ArrowRight className="size-4 flex-none text-[var(--l-ink-tertiary)] transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
