"use client"

import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@workspace/ui/lib/utils"

import { Reveal } from "@/components/marketing/motion"

/**
 * The output demo — the page's second (and last) live embed. One real guide,
 * shown two ways: a scrollable list and an interactive walkthrough, swapped by a
 * segmented toggle. Proves the product does the thing, without embedding in
 * every section. Client island (toggle state + crossfade); the iframe is the
 * only network cost and loads on view.
 */
const GUIDE = process.env.NEXT_PUBLIC_DEMO_GUIDE_TOGGLE || "uv9If_7NHl8y"
const MODES = [
  { key: "list", label: "Scroll" },
  { key: "interactive", label: "Walkthrough" },
] as const
type Mode = (typeof MODES)[number]["key"]

export function OutputDemo() {
  const reduce = useReducedMotion()
  const [mode, setMode] = React.useState<Mode>("list")

  return (
    <section id="demo" className="scroll-mt-20 border-y border-[var(--l-hairline)] bg-[var(--l-canvas)]">
      <div className="mx-auto max-w-5xl px-5 py-24 sm:px-8 sm:py-32">
        <Reveal className="text-center">
          <p className="font-mono text-[11px] tracking-widest text-cobalt uppercase">The output</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.02em] text-balance text-[var(--l-ink)] sm:text-5xl">
            See exactly what your readers see.
          </h2>
          <p className="mt-4 font-accent text-[21px] text-[var(--l-ink-subtle)] sm:text-[24px]">
            One guide — read it as a scroll or click through it live.
          </p>
        </Reveal>

        {/* segmented toggle */}
        <div className="mt-10 flex justify-center">
          <div role="tablist" aria-label="Guide view" className="relative inline-flex rounded-full border border-[var(--l-hairline)] bg-white p-1 shadow-sm">
            {MODES.map((m) => {
              const active = mode === m.key
              return (
                <button
                  key={m.key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(m.key)}
                  className={cn(
                    "relative z-10 rounded-full px-5 py-2 text-[13.5px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-cobalt/50 focus-visible:outline-none",
                    active ? "text-white" : "text-[var(--l-ink-subtle)] hover:text-[var(--l-ink)]"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="demo-toggle-pill"
                      className="absolute inset-0 -z-10 rounded-full bg-primary"
                      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* framed embed */}
        <Reveal delay={0.1} className="relative mx-auto mt-10 max-w-3xl">
          <div aria-hidden className="pointer-events-none absolute inset-x-10 -bottom-6 -z-10 h-24 rounded-full bg-cobalt/20 blur-3xl" />
          <div className="overflow-hidden rounded-2xl border border-[var(--l-hairline)] bg-white shadow-[0_40px_120px_-30px_rgba(20,23,40,0.35)]">
            {/* Scroll view has no chrome of its own, so give it a browser bar.
                Walkthrough renders its own player frame — no second frame. */}
            {mode === "list" && (
              <div className="flex items-center gap-1.5 border-b border-[var(--l-hairline)] px-4 py-3">
                <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                <span className="size-2.5 rounded-full bg-[#febc2e]" />
                <span className="size-2.5 rounded-full bg-[#28c840]" />
                <span className="mx-auto rounded-md bg-[var(--l-canvas)] px-3 py-1 font-mono text-[11px] text-[var(--l-ink-tertiary)]">
                  tacto.fyi/g/…
                </span>
              </div>
            )}
            <div className="relative h-[560px] w-full">
              <AnimatePresence mode="wait" initial={false}>
                <motion.iframe
                  key={mode}
                  src={`/embed/g/${GUIDE}?mode=${mode}&theme=light`}
                  title={mode === "list" ? "Guide — scroll view" : "Guide — walkthrough"}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full bg-white"
                  initial={reduce ? { opacity: 1 } : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduce ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                />
              </AnimatePresence>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
