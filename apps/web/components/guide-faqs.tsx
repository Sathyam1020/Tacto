"use client"

import * as React from "react"

import type { Faq } from "@workspace/contracts/guide"
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"

/**
 * Reader-facing FAQ section — a keyboard-accessible accordion (base-ui handles
 * arrow keys / Home / End / Enter) with smooth height animation and Expand /
 * Collapse all. Renders nothing when there are no FAQs.
 */
export function GuideFaqs({ faqs }: { faqs: Faq[] }) {
  const ids = React.useMemo(() => faqs.map((_, i) => String(i)), [faqs])
  const [open, setOpen] = React.useState<string[]>([])

  if (faqs.length === 0) return null
  const allOpen = open.length === faqs.length

  return (
    <section className="mt-16 border-t pt-10">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serif text-2xl font-medium tracking-tight text-balance">
          Frequently asked questions
        </h2>
        {faqs.length > 1 && (
          <button
            type="button"
            onClick={() => setOpen(allOpen ? [] : ids)}
            className="text-muted-foreground hover:text-foreground shrink-0 text-sm font-medium transition-colors"
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>
      <Accordion
        className="mt-6"
        value={open}
        onValueChange={(value) => setOpen(value as string[])}
        multiple
      >
        {faqs.map((faq, i) => (
          <AccordionItem key={i} value={String(i)}>
            <AccordionTrigger>{faq.question}</AccordionTrigger>
            <AccordionPanel className="text-muted-foreground leading-relaxed">
              {faq.answer}
            </AccordionPanel>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
