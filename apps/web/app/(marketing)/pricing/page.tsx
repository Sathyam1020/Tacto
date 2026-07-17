import type { Metadata } from "next"

import { Cta } from "@/components/marketing/cta"
import { FaqAccordion, type QA } from "@/components/marketing/faq-accordion"
import { Reveal } from "@/components/marketing/motion"
import { PageHero } from "@/components/marketing/page-hero"
import { PricingComparison } from "@/components/marketing/pricing-comparison"
import { PricingPlans } from "@/components/marketing/pricing-plans"
import { jsonLd, pageMeta } from "@/lib/marketing/seo"

export const metadata: Metadata = pageMeta({
  title: "Pricing",
  description:
    "Simple, transparent pricing for Tacto. Start free with 5 guides, then scale to unlimited guides, AI credits, custom branding, analytics, and SSO. Save two months with yearly billing.",
  path: "/pricing",
})

const FAQ: QA[] = [
  {
    q: "What counts as an AI credit?",
    a: "Credits are spent when Tacto's AI does work for you — writing the steps for a recording, generating a summary or FAQ, translating a guide, or narrating a walkthrough. Viewing, editing, and sharing guides never costs credits. Unused credits reset at the start of each billing cycle.",
  },
  {
    q: "Can I try the paid features before paying?",
    a: "Yes. Every paid plan starts with a free trial — no credit card to begin. You get the full plan during the trial so you can publish real guides, invite a teammate, and see the analytics before you decide.",
  },
  {
    q: "What happens when I hit the 5-guide limit on Free?",
    a: "Your existing guides stay live and viewable forever. To create a sixth guide you upgrade to Pro, which lifts the cap to unlimited. Nothing you've already published is ever taken down.",
  },
  {
    q: "Can I add teammates?",
    a: "Yes. Pro and Plus include one seat and let you add more at the per-seat price shown. Business includes five seats out of the box. Everyone in a workspace shares guides, branding, and analytics.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Anytime, from Settings — no email, no phone call. When you cancel, you keep paid features until the end of the period you've already paid for, then drop to Free.",
  },
  {
    q: "Do my guides stay live if I downgrade?",
    a: "Always. Downgrading only changes what you can create next — every guide you've published stays online at its existing link and embed. If you're over the Free plan's guide limit, older guides simply become read-only until you're back under it.",
  },
  {
    q: "Do you offer refunds?",
    a: "If Tacto isn't for you, cancel within the first three days of a paid subscription and we'll refund the full amount, no questions asked.",
  },
  {
    q: "Do you offer discounts for nonprofits or education?",
    a: "We do. Reach out from the contact page with a bit about your organization and we'll get you set up.",
  },
]

const SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Product",
      name: "Tacto",
      description: "AI workflow capture that turns any process into a step-by-step guide, interactive walkthrough, or help center.",
      brand: { "@type": "Brand", name: "Tacto" },
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "USD",
        lowPrice: "0",
        highPrice: "75",
        offerCount: "4",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: typeof f.a === "string" ? f.a : "" },
      })),
    },
  ],
}

export default function PricingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(SCHEMA) }} />
      <PageHero
        eyebrow="Pricing"
        title="Pricing that scales with your team."
        subtitle="Start free. Upgrade when it pays for itself."
      />
      <section className="bg-white pt-16 sm:pt-20">
        <PricingPlans />
      </section>
      <PricingComparison />

      <section className="border-t border-[var(--l-hairline)] bg-[var(--l-canvas)]">
        <div className="mx-auto max-w-3xl px-5 py-24 sm:px-8 sm:py-28">
          <Reveal className="text-center">
            <p className="font-mono text-[11px] tracking-widest text-cobalt uppercase">Pricing FAQ</p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.02em] text-[var(--l-ink)] sm:text-4xl">
              Questions, answered.
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="mt-10">
            <FaqAccordion items={FAQ} />
          </Reveal>
        </div>
      </section>

      <Cta />
    </>
  )
}
