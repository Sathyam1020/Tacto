import type * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

import { Reveal } from "@/components/marketing/motion"

/**
 * The standard top-of-page hero for interior marketing pages (pricing, blog,
 * use cases, compare, legal…). Eyebrow + display headline + editorial-serif
 * subhead, over the canvas with a faint dot field. Server-rendered; only the
 * Reveal wrapper hydrates. Landing keeps its own bespoke hero.
 */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  children,
  className,
}: {
  eyebrow: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Optional actions row (CTAs) under the subtitle. */
  children?: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("relative overflow-hidden border-b border-[var(--l-hairline)] bg-[var(--l-canvas)]", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage: "radial-gradient(var(--l-dot) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(90% 60% at 50% 0%, #000 0%, transparent 75%)",
        }}
      />
      <div className="relative mx-auto max-w-3xl px-5 pt-20 pb-16 text-center sm:px-8 sm:pt-28 sm:pb-20">
        <Reveal>
          <p className="font-mono text-[11px] tracking-widest text-cobalt uppercase">{eyebrow}</p>
          <h1 className="mx-auto mt-4 max-w-2xl font-display text-4xl font-semibold tracking-[-0.02em] text-balance text-[var(--l-ink)] sm:text-[56px] sm:leading-[1.04]">
            {title}
          </h1>
          {subtitle && (
            <p className="mx-auto mt-5 max-w-xl font-accent text-[22px] leading-snug text-[var(--l-ink-subtle)] sm:text-[26px]">
              {subtitle}
            </p>
          )}
          {children && <div className="mt-9 flex flex-wrap items-center justify-center gap-3">{children}</div>}
        </Reveal>
      </div>
    </section>
  )
}
