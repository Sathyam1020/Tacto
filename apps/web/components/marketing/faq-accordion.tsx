"use client"

import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ChevronDown } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

const EASE = [0.22, 1, 0.36, 1] as const

export type QA = { q: string; a: React.ReactNode }

/**
 * A reusable, accessible FAQ accordion — one open at a time, animated height,
 * focus rings. Shared by pricing, use-case, compare, and tool pages. The
 * matching FAQPage JSON-LD is emitted separately by each page (server-side).
 */
export function FaqAccordion({ items, className }: { items: QA[]; className?: string }) {
  const [open, setOpen] = React.useState<number | null>(0)
  const reduce = useReducedMotion()
  return (
    <div className={cn("divide-y divide-[var(--l-hairline)] overflow-hidden rounded-2xl border border-[var(--l-hairline)] bg-white", className)}>
      {items.map((it, i) => {
        const isOpen = open === i
        return (
          <div key={i}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--l-hover)]/50 focus-visible:ring-2 focus-visible:ring-cobalt/40 focus-visible:outline-none sm:px-6"
            >
              <span className="text-[15.5px] font-medium text-[var(--l-ink)]">{it.q}</span>
              <ChevronDown className={cn("size-4 flex-none text-[var(--l-ink-tertiary)] transition-transform duration-300", isOpen && "rotate-180")} />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={reduce ? undefined : { height: 0, opacity: 0 }}
                  animate={reduce ? undefined : { height: "auto", opacity: 1 }}
                  exit={reduce ? undefined : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 text-[14.5px] leading-relaxed text-[var(--l-ink-subtle)] sm:px-6">
                    {it.a}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
