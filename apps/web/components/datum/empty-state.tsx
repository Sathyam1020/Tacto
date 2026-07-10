"use client"

import * as React from "react"
import { m, useReducedMotion } from "motion/react"

import { cn } from "@workspace/ui/lib/utils"

import { spring } from "./motion"

/**
 * The proprietary Datum line illustration — a browser wireframe threaded by
 * the throughline + waypoints + a reticle, drawn in on view with Framer
 * Motion. This is the Rive-ready slot: swap in a <RiveArt> later.
 */
export function ThroughlineIllustration({ className }: { className?: string }) {
  const reduce = useReducedMotion()
  const draw = {
    hidden: { pathLength: 0, opacity: 0 },
    show: (i: number) => ({
      pathLength: 1,
      opacity: 1,
      transition: {
        pathLength: {
          duration: 0.9,
          delay: 0.12 * i,
          ease: [0.22, 1, 0.36, 1] as const,
        },
        opacity: { duration: 0.01, delay: 0.12 * i },
      },
    }),
  }
  const node = {
    hidden: { scale: 0, opacity: 0 },
    show: (i: number) => ({
      scale: 1,
      opacity: 1,
      transition: { ...spring, delay: 0.4 + 0.16 * i },
    }),
  }
  return (
    <m.svg
      width="232"
      height="150"
      viewBox="0 0 232 150"
      fill="none"
      className={cn("mx-auto", className)}
      initial={reduce ? "show" : "hidden"}
      whileInView="show"
      viewport={{ once: true }}
      aria-hidden="true"
    >
      <m.rect x="29" y="16" width="174" height="118" rx="11" stroke="var(--line-2)" strokeWidth="1.5" variants={draw} custom={0} />
      <m.path d="M29 40h174" stroke="var(--line-2)" strokeWidth="1.5" variants={draw} custom={1} />
      <circle cx="43" cy="28" r="2.5" fill="var(--line-2)" />
      <circle cx="53" cy="28" r="2.5" fill="var(--line-2)" />
      <circle cx="63" cy="28" r="2.5" fill="var(--line-2)" />
      <m.path d="M67 96 L115 66 L161 104" stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="4 5" strokeLinecap="round" variants={draw} custom={2} />
      {[
        { x: 67, y: 96, n: "1", on: true },
        { x: 115, y: 66, n: "2", on: true },
        { x: 161, y: 104, n: "3", on: false },
      ].map((p, i) => (
        <m.g key={p.n} variants={node} custom={i}>
          <circle cx={p.x} cy={p.y} r="8" fill="var(--plate)" stroke={p.on ? "var(--primary)" : "var(--line-2)"} strokeWidth="1.5" />
          <text x={p.x} y={p.y + 3.2} fontSize="9" fill={p.on ? "var(--primary)" : "var(--muted-foreground)"} textAnchor="middle" fontFamily="var(--font-mono)">
            {p.n}
          </text>
        </m.g>
      ))}
    </m.svg>
  )
}

/** Reusable Datum empty state — illustration, title, guidance, one action. */
export function EmptyState({
  title,
  description,
  action,
  illustration,
  className,
}: {
  title: string
  description: string
  action?: React.ReactNode
  illustration?: React.ReactNode
  className?: string
}) {
  const reduce = useReducedMotion()
  return (
    <m.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }}
      className={cn(
        "border-border bg-card flex flex-col items-center rounded-2xl border px-6 py-14 text-center",
        className
      )}
    >
      {illustration ?? <ThroughlineIllustration />}
      <h3 className="mt-6 text-xl font-semibold tracking-tight">{title}</h3>
      <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </m.div>
  )
}
