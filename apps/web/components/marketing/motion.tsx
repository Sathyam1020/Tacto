"use client"

import * as React from "react"
import { motion, useReducedMotion, type Variants } from "motion/react"

/**
 * Marketing motion primitives. Small, composable client islands so server
 * sections stay server-rendered and only the animation wrapper hydrates.
 * Everything degrades to static markup under `prefers-reduced-motion`.
 *
 *  - <Stagger> + <Item>: an orchestrated on-mount entrance (the hero).
 *  - <Reveal>: a single element that rises in when scrolled into view (sections).
 * The easing is a slow, expensive-feeling ease-out — never bouncy.
 */
const EASE = [0.22, 1, 0.36, 1] as const

const riseVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
}

/** Orchestrates a staggered entrance for its <Item> children on mount. */
export function Stagger({
  children,
  className,
  delay = 0,
  gap = 0.09,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  gap?: number
}) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: gap, delayChildren: delay } } }}
    >
      {children}
    </motion.div>
  )
}

/** A single child of <Stagger> (inherits the parent's hidden→show timing). */
export function Item({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div className={className} variants={riseVariants}>
      {children}
    </motion.div>
  )
}

/** A scroll-triggered container that staggers its <Item> children into view. */
export function StaggerReveal({
  children,
  className,
  gap = 0.08,
}: {
  children: React.ReactNode
  className?: string
  gap?: number
}) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={{ show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  )
}

/** A standalone element that rises in once, when scrolled into view. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}
