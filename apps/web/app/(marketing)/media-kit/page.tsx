import type { Metadata } from "next"

import { LogoMark } from "@workspace/ui/components/logo"

import { Reveal } from "@/components/marketing/motion"
import { PageHero } from "@/components/marketing/page-hero"
import { pageMeta } from "@/lib/marketing/seo"

export const metadata: Metadata = pageMeta({
  title: "Media kit",
  description: "Tacto's logo, colors, and typography, with guidelines for using the brand. For source files, get in touch.",
  path: "/media-kit",
})

const COLORS = [
  { name: "Cobalt", hex: "#5E6AD2", note: "Primary accent" },
  { name: "Ink", hex: "#16181F", note: "Text on light" },
  { name: "Canvas", hex: "#ECEEF2", note: "Light surface" },
  { name: "Night", hex: "#0B0C10", note: "Dark surface" },
]

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] tracking-widest text-cobalt uppercase">{children}</p>
}

export default function MediaKitPage() {
  return (
    <>
      <PageHero eyebrow="Media kit" title="The Tacto brand." subtitle="Use these assets to represent Tacto accurately." />
      <section className="bg-white">
        <div className="mx-auto max-w-4xl space-y-20 px-5 py-20 sm:px-8 sm:py-24">
          {/* Logo */}
          <Reveal>
            <SectionTitle>Logo</SectionTitle>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-[var(--l-hairline)] bg-white py-16">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-cobalt">
                  <LogoMark className="size-6" />
                </span>
                <span className="font-display text-2xl font-semibold tracking-tight text-[var(--l-ink)]">Tacto</span>
              </div>
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[#0b0c10] py-16">
                <span className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-white">
                  <LogoMark className="size-6" />
                </span>
                <span className="font-display text-2xl font-semibold tracking-tight text-white">Tacto</span>
              </div>
            </div>
            <p className="mt-4 text-[14px] leading-relaxed text-[var(--l-ink-subtle)]">
              Keep clear space around the logo, don&apos;t stretch or recolor the mark, and use the light or dark
              lockup that fits your background.
            </p>
          </Reveal>

          {/* Colors */}
          <Reveal>
            <SectionTitle>Colors</SectionTitle>
            <div className="mt-5 grid gap-4 sm:grid-cols-4">
              {COLORS.map((c) => (
                <div key={c.hex} className="overflow-hidden rounded-2xl border border-[var(--l-hairline)]">
                  <div className="h-24" style={{ backgroundColor: c.hex }} />
                  <div className="p-4">
                    <p className="text-[14px] font-semibold text-[var(--l-ink)]">{c.name}</p>
                    <p className="font-mono text-[12px] text-[var(--l-ink-tertiary)]">{c.hex}</p>
                    <p className="mt-1 text-[12px] text-[var(--l-ink-subtle)]">{c.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Typography */}
          <Reveal>
            <SectionTitle>Typography</SectionTitle>
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-[var(--l-hairline)] p-6">
                <p className="font-display text-3xl font-semibold tracking-tight text-[var(--l-ink)]">Bricolage Grotesque</p>
                <p className="mt-1 text-[13px] text-[var(--l-ink-tertiary)]">Display — headlines</p>
              </div>
              <div className="rounded-2xl border border-[var(--l-hairline)] p-6">
                <p className="font-accent text-3xl text-[var(--l-ink)]">Instrument Serif</p>
                <p className="mt-1 text-[13px] text-[var(--l-ink-tertiary)]">Accent — editorial subheads (italic)</p>
              </div>
              <div className="rounded-2xl border border-[var(--l-hairline)] p-6">
                <p className="text-3xl font-medium text-[var(--l-ink)]">Geist</p>
                <p className="mt-1 text-[13px] text-[var(--l-ink-tertiary)]">Body & UI</p>
              </div>
            </div>
          </Reveal>

          {/* Source files */}
          <Reveal>
            <div className="rounded-3xl border border-[var(--l-hairline)] bg-[var(--l-canvas)] p-8 text-center">
              <h2 className="font-display text-xl font-semibold tracking-tight text-[var(--l-ink)]">Need source files?</h2>
              <p className="mx-auto mt-2 max-w-md text-[14.5px] text-[var(--l-ink-subtle)]">
                For vector logos, product screenshots, or anything else, email{" "}
                <a href="mailto:hello@tacto.fyi" className="font-medium text-cobalt underline underline-offset-2">
                  hello@tacto.fyi
                </a>{" "}
                and we&apos;ll send the full kit.
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
