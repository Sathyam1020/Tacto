import Link from "next/link"
import { ArrowRight, Play, Sparkles } from "lucide-react"

import { buttonVariants } from "@workspace/ui/components/button"

import { CtaLink } from "@/components/analytics/cta-link"
import { HeroEmbed } from "@/components/marketing/hero-embed"
import { Item, Reveal, Stagger } from "@/components/marketing/motion"

/**
 * Hero. Answers what / who / why within five seconds: Tacto turns any screen
 * recording into a finished guide, for the teams who'd rather ship than write.
 * Server-rendered; only the entrance/reveal wrappers hydrate.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <Ambient />

      {/* Compact text so the live demo lands in the first view. */}
      <div className="mx-auto max-w-3xl px-5 pt-8 pb-8 text-center sm:pt-10">
        <Stagger className="flex flex-col items-center">
          <Item>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--l-hairline)] bg-white px-2.5 py-0.5 font-mono text-[10px] tracking-wide text-[var(--l-ink-subtle)] uppercase shadow-sm">
              <Sparkles className="size-3 text-cobalt" /> AI guide capture
            </span>
          </Item>

          <Item>
            <h1 className="mt-4 font-display text-[38px] leading-[1.02] font-semibold tracking-[-0.02em] text-balance text-[var(--l-ink)] sm:text-[54px]">
              Guides that write themselves.
            </h1>
          </Item>

          <Item>
            <p className="mt-3 font-accent text-[20px] leading-snug text-[var(--l-ink-subtle)] sm:text-[24px]">
              Record it once — Tacto documents it forever.
            </p>
          </Item>

          <Item>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <CtaLink location="hero" label="Start for free" href="/sign-up" className={buttonVariants({ size: "lg" })}>
                Start for free <ArrowRight className="size-4" />
              </CtaLink>
              <Link href="#see-it" className={buttonVariants({ size: "lg", variant: "outline" })}>
                <Play className="size-4" /> See it in action
              </Link>
            </div>
          </Item>

          <Item>
            <p className="mt-4 font-mono text-[11px] tracking-wide text-[var(--l-ink-tertiary)] uppercase">
              Free forever · No credit card · Live in under a minute
            </p>
          </Item>
        </Stagger>
      </div>

      {/* Interactive demo — wide, with a hand-drawn note pointing at it. */}
      <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-8">
        <Reveal className="mb-2 flex justify-center sm:justify-end sm:pr-8">
          <HandNote />
        </Reveal>
        <Reveal delay={0.1}>
          <HeroEmbed />
        </Reveal>
      </div>
    </section>
  )
}

/** A hand-written note with a curved arrow pointing at the live demo — the
 *  brand's editorial-serif italic (its "handwriting"). */
function HandNote() {
  return (
    <div className="flex flex-col items-center text-[var(--l-ink-subtle)] sm:items-end">
      <p className="font-accent text-center text-[19px] leading-tight italic sm:text-right sm:text-[23px]">
        This is an interactive guide
        <br />
        created using Tacto
      </p>
      <svg
        aria-hidden
        viewBox="0 0 60 56"
        className="mt-0.5 h-10 w-10 text-[var(--l-ink-tertiary)] sm:mr-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M45 4 C 50 22, 41 41, 14 49" />
        <path d="M14 49 l 13 -1.5" />
        <path d="M14 49 l 6 -12" />
      </svg>
    </div>
  )
}

function Ambient() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute top-[-14%] left-1/2 h-[560px] w-[920px] -translate-x-1/2 rounded-full bg-cobalt/10 blur-[140px]" />
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage: "radial-gradient(var(--l-hairline-strong) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage: "radial-gradient(ellipse 60% 42% at 50% 0%, #000 20%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 60% 42% at 50% 0%, #000 20%, transparent 75%)",
        }}
      />
    </div>
  )
}
