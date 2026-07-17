"use client"

import * as React from "react"
import { motion, useReducedMotion, useScroll, useSpring } from "motion/react"
import { Share2, Sparkles, Video } from "lucide-react"

const EASE = [0.22, 1, 0.36, 1] as const

const STEPS = [
  {
    icon: Video,
    title: "Record",
    body: "Hit record and run through your process once. The Tacto extension captures every click, keystroke, and screen — no setup, no script, no editing software.",
  },
  {
    icon: Sparkles,
    title: "Refine",
    body: "AI writes each step, pinpoints exactly where you clicked, and lays it out. Blur secrets, tweak wording, add your brand — or ship it untouched. It's already good.",
  },
  {
    icon: Share2,
    title: "Ship",
    body: "Publish a link, embed it on any site, drop it in a help center, or export to PDF and video. Then see who actually finished — step by step.",
  },
]

export function Timeline() {
  const reduce = useReducedMotion()
  const ref = React.useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.75", "end 0.55"],
  })
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 28, restDelta: 0.001 })

  return (
    <section className="relative overflow-hidden bg-[radial-gradient(120%_120%_at_50%_-10%,#6b74dd_0%,#5860c9_45%,#454da6_100%)] text-white">
      <div className="mx-auto max-w-3xl px-5 py-24 sm:px-8 sm:py-32">
        <div className="text-center">
          <p className="font-mono text-[11px] tracking-widest text-white/60 uppercase">How it works</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.02em] text-balance sm:text-5xl">
            From “let me show you” to “here&apos;s the link.”
          </h2>
          <p className="mt-4 font-accent text-[21px] text-white/70 sm:text-[24px]">Three steps. About a minute.</p>
        </div>

        <div ref={ref} className="relative mx-auto mt-16 max-w-xl">
          {/* rail track + animated fill */}
          <div className="absolute top-3 bottom-3 left-[19px] w-px bg-white/20" aria-hidden />
          <motion.div
            className="absolute top-3 bottom-3 left-[19px] w-px origin-top bg-white"
            style={{ scaleY: reduce ? 1 : fill }}
            aria-hidden
          />

          <ol className="space-y-6">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative pl-16">
                {/* node */}
                <motion.span
                  className="absolute top-2 left-[11px] flex size-4 items-center justify-center rounded-full bg-white shadow-[0_0_0_5px_rgba(94,106,210,0.6)]"
                  initial={reduce ? undefined : { scale: 0 }}
                  whileInView={reduce ? undefined : { scale: 1 }}
                  viewport={{ once: true, margin: "-120px" }}
                  transition={{ duration: 0.4, ease: EASE, delay: 0.05 }}
                >
                  <span className="size-1.5 rounded-full bg-cobalt" />
                </motion.span>

                {/* card */}
                <motion.div
                  className="rounded-2xl bg-white p-6 text-[var(--l-ink)] shadow-[0_20px_50px_-24px_rgba(20,23,40,0.55)] sm:p-7"
                  initial={reduce ? undefined : { opacity: 0, y: 20 }}
                  whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.6, ease: EASE }}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-primary/10 text-cobalt">
                      <s.icon className="size-5" />
                    </span>
                    <h3 className="font-display text-xl font-semibold tracking-tight">{s.title}</h3>
                    <span className="ml-auto font-mono text-xs text-[var(--l-ink-tertiary)]">0{i + 1}</span>
                  </div>
                  <p className="mt-3.5 text-[14.5px] leading-relaxed text-[var(--l-ink-subtle)]">{s.body}</p>
                </motion.div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
