"use client"

import * as React from "react"
import { m, useReducedMotion, type Variants } from "motion/react"

/**
 * Datum motion foundation. Uses lightweight `m.*` components (tree-shaken via
 * the app-wide <LazyMotion features={domMax}> in providers). Springs express
 * precision + momentum; nothing bounces for show; reduced motion is honored.
 */

export const spring = { type: "spring" as const, stiffness: 380, damping: 30 }
export const softSpring = { type: "spring" as const, stiffness: 140, damping: 22 }
export const gentle = { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }

/** Press + hover feedback props for interactive elements. */
export const pressable = {
  whileTap: { scale: 0.97 },
  transition: spring,
}

/** Scroll-reveal that fades/rises content in once, respecting reduced motion. */
export function Reveal({
  children,
  delay = 0,
  y = 16,
  className,
  as = "div",
}: {
  children: React.ReactNode
  delay?: number
  y?: number
  className?: string
  as?: "div" | "section" | "li" | "article"
}) {
  const reduce = useReducedMotion()
  const Comp = m[as]
  return (
    <Comp
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ ...softSpring, delay }}
    >
      {children}
    </Comp>
  )
}

/** Staggered container + item variants for lists/grids. */
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: softSpring },
}
