"use client"

import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * A polished, professional "generating…" state for async AI work (narration
 * and translation). It runs in the background on the worker, so the copy makes
 * clear the user can walk away. Two flavours: an audio equalizer for voice, a
 * cycling-script shimmer for translation. Respects reduced-motion.
 */
export function GeneratingState({
  variant,
  title,
  subtitle,
  className,
}: {
  variant: "voice" | "translation"
  title: string
  subtitle?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-6 px-6 py-14 text-center",
        className
      )}
    >
      <Aura>
        {variant === "voice" ? <Equalizer /> : <ScriptCycler />}
      </Aura>

      <div className="space-y-1.5">
        <motion.h3
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-foreground text-base font-semibold tracking-tight"
        >
          {title}
        </motion.h3>
        {subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="text-muted-foreground mx-auto max-w-xs text-sm"
          >
            {subtitle}
          </motion.p>
        )}
      </div>

      <ShimmerBar />

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="text-muted-foreground/70 text-xs"
      >
        This runs in the background — you can close this and come back.
      </motion.p>
    </div>
  )
}

/** A soft, breathing radial glow behind the animated glyph. */
function Aura({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <div className="relative grid size-24 place-items-center">
      <motion.span
        aria-hidden
        className="bg-primary/15 absolute inset-0 rounded-full blur-xl"
        animate={reduce ? undefined : { scale: [1, 1.18, 1], opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.span
        aria-hidden
        className="border-primary/25 absolute inset-2 rounded-full border"
        animate={reduce ? undefined : { scale: [1, 1.08, 1], opacity: [0.6, 0.2, 0.6] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      />
      <div className="bg-card relative grid size-16 place-items-center rounded-2xl border shadow-sm">
        {children}
      </div>
    </div>
  )
}

/** Voice: a five-bar equalizer bouncing on staggered loops. */
function Equalizer() {
  const reduce = useReducedMotion()
  const bars = [0.35, 0.7, 1, 0.6, 0.4]
  return (
    <div className="flex h-7 items-end gap-[3px]" aria-hidden>
      {bars.map((peak, i) => (
        <motion.span
          key={i}
          className="bg-primary w-[3px] rounded-full"
          style={{ height: "100%", originY: 1 }}
          initial={{ scaleY: 0.3 }}
          animate={
            reduce
              ? { scaleY: peak }
              : { scaleY: [0.3, peak, 0.3] }
          }
          transition={{
            duration: 0.9,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.12,
          }}
        />
      ))}
    </div>
  )
}

/** Translation: cycle through world scripts with a soft crossfade. */
const GLYPHS = ["A", "文", "あ", "ع", "Я", "अ"]
function ScriptCycler() {
  const reduce = useReducedMotion()
  const [i, setI] = React.useState(0)
  React.useEffect(() => {
    if (reduce) return
    const t = setInterval(() => setI((n) => (n + 1) % GLYPHS.length), 700)
    return () => clearInterval(t)
  }, [reduce])
  return (
    <div className="relative grid size-7 place-items-center" aria-hidden>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
          transition={{ duration: 0.35 }}
          className="text-primary absolute text-2xl font-semibold"
        >
          {GLYPHS[i]}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}

/** Indeterminate shimmer progress bar. */
function ShimmerBar() {
  const reduce = useReducedMotion()
  return (
    <div className="bg-muted relative h-1 w-40 overflow-hidden rounded-full">
      {reduce ? (
        <span className="bg-primary/60 absolute inset-y-0 left-0 w-1/2 rounded-full" />
      ) : (
        <motion.span
          className="bg-primary absolute inset-y-0 w-1/3 rounded-full"
          animate={{ left: ["-33%", "100%"] }}
          transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  )
}
