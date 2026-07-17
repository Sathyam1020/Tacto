import { FaqList, type Faq } from "@/components/marketing/faq-list"
import { Reveal } from "@/components/marketing/motion"

/**
 * FAQ. Answer-first copy (AEO) and a `FAQPage` JSON-LD that mirrors the visible
 * questions exactly — the schema is emitted server-side; only the accordion
 * hydrates.
 */
const FAQS: Faq[] = [
  {
    q: "How does Tacto create a guide?",
    a: "You record a workflow with the Tacto browser extension. It captures each click and screen, then AI writes a clear step for every action and pinpoints exactly where to click — so a finished, editable guide is ready in seconds.",
  },
  {
    q: "Do I have to edit anything?",
    a: "No. Every guide is publish-ready out of the box. You can tweak wording, blur sensitive data, reorder steps, or add branding whenever you want — but you never have to.",
  },
  {
    q: "Where can I share or embed guides?",
    a: "Anywhere. Share a public link, embed an auto-resizing widget or launcher popup on any site (Notion, Framer, your docs), add it to a branded help center, or export to PDF and video.",
  },
  {
    q: "What can Tacto capture?",
    a: "Any web-based workflow in your browser. Tacto records screenshots and interactions — never a raw screen recording — so guides stay crisp, editable, and light.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes. The free plan includes AI step writing, public links, and embeds. Paid plans unlock unlimited guides, exports, custom branding, translations, help centers, and analytics.",
  },
  {
    q: "Can a whole team use it?",
    a: "Yes. Team plans add shared workspaces, roles, a branded help center, and analytics so everyone can build and maintain documentation together.",
  },
]

const SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
}

export function Faq() {
  return (
    <section className="border-y border-[var(--l-hairline)] bg-[var(--l-canvas)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }} />
      <div className="mx-auto max-w-3xl px-5 py-24 sm:px-8 sm:py-32">
        <Reveal className="text-center">
          <p className="font-mono text-[11px] tracking-widest text-cobalt uppercase">FAQ</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.02em] text-balance text-[var(--l-ink)] sm:text-5xl">
            Questions, answered.
          </h2>
        </Reveal>
        <Reveal delay={0.1} className="mt-12">
          <FaqList items={FAQS} />
        </Reveal>
      </div>
    </section>
  )
}
