"use client"

import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Plus } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

const EASE = [0.22, 1, 0.36, 1] as const

export type Faq = { q: string; a: string }

/** Accessible accordion (button + aria-expanded + region), with an animated
 *  height reveal that collapses to an instant toggle under reduced motion. */
export function FaqList({ items }: { items: Faq[] }) {
  const reduce = useReducedMotion()
  const [open, setOpen] = React.useState<number | null>(null)

  return (
    <div className="divide-y divide-[var(--l-hairline)] border-y border-[var(--l-hairline)]">
      {items.map((f, i) => {
        const isOpen = open === i
        return (
          <div key={f.q}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`faq-panel-${i}`}
              id={`faq-trigger-${i}`}
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 rounded-lg py-5 text-left focus-visible:ring-2 focus-visible:ring-cobalt/50 focus-visible:outline-none"
            >
              <span className="text-[15.5px] font-medium text-[var(--l-ink)]">{f.q}</span>
              <span
                className={cn(
                  "flex size-6 flex-none items-center justify-center rounded-full border border-[var(--l-hairline)] text-[var(--l-ink-subtle)] transition-transform duration-300",
                  isOpen && "rotate-45 border-cobalt bg-primary/10 text-cobalt"
                )}
              >
                <Plus className="size-3.5" />
              </span>
            </button>

            {reduce ? (
              isOpen && (
                <p id={`faq-panel-${i}`} role="region" aria-labelledby={`faq-trigger-${i}`} className="pr-8 pb-5 text-[14.5px] leading-relaxed text-[var(--l-ink-subtle)]">
                  {f.a}
                </p>
              )
            ) : (
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="panel"
                    id={`faq-panel-${i}`}
                    role="region"
                    aria-labelledby={`faq-trigger-${i}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <p className="pr-8 pb-5 text-[14.5px] leading-relaxed text-[var(--l-ink-subtle)]">{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        )
      })}
    </div>
  )
}
