import Link from "next/link"
import { ArrowRight, Play, Sparkles } from "lucide-react"

import { buttonVariants } from "@workspace/ui/components/button"

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

      <div className="mx-auto max-w-3xl px-5 pt-12 pb-12 text-center sm:pt-16">
        <Stagger className="flex flex-col items-center">
          <Item>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--l-hairline)] bg-white px-2.5 py-0.5 font-mono text-[10px] tracking-wide text-[var(--l-ink-subtle)] uppercase shadow-sm">
              <Sparkles className="size-3 text-cobalt" /> AI guide capture
            </span>
          </Item>

          <Item>
            <h1 className="mt-5 font-display text-[44px] leading-[1.02] font-semibold tracking-[-0.02em] text-balance text-[var(--l-ink)] sm:text-[68px]">
              Guides that write themselves.
            </h1>
          </Item>

          <Item>
            <p className="mt-4 font-accent text-[22px] leading-snug text-[var(--l-ink-subtle)] sm:text-[26px]">
              Record it once — Tacto documents it forever.
            </p>
          </Item>

          <Item>
            <p className="mx-auto mt-6 max-w-lg text-[15px] leading-relaxed text-[var(--l-ink-subtle)] sm:text-[17px]">
              Record any workflow once and Tacto turns every click into a polished step-by-step guide,
              walkthrough, or branded help center — for teams who&apos;d rather ship than write docs.
            </p>
          </Item>

          <Item>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/sign-up" className={buttonVariants({ size: "lg" })}>
                Start for free <ArrowRight className="size-4" />
              </Link>
              <Link href="#see-it" className={buttonVariants({ size: "lg", variant: "outline" })}>
                <Play className="size-4" /> See it in action
              </Link>
            </div>
          </Item>

          <Item>
            <p className="mt-5 font-mono text-[11px] tracking-wide text-[var(--l-ink-tertiary)] uppercase">
              Free forever · No credit card · Live in under a minute
            </p>
          </Item>
        </Stagger>
      </div>

      <div className="mx-auto max-w-5xl px-5 pb-24 sm:px-8">
        <Reveal delay={0.35}>
          <HeroEmbed />
        </Reveal>
      </div>
    </section>
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
