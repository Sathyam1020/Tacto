import type { Metadata } from "next"

import { Cta } from "@/components/marketing/cta"
import { Faq } from "@/components/marketing/faq"
import { Features } from "@/components/marketing/features"
import { HelpCenter } from "@/components/marketing/help-center"
import { Hero } from "@/components/marketing/hero"
import { LogoStrip } from "@/components/marketing/logo-strip"
import { Manifesto } from "@/components/marketing/manifesto"
import { OutputDemo } from "@/components/marketing/output-demo"
import { Timeline } from "@/components/marketing/timeline"
import { UseCases } from "@/components/marketing/use-cases"

/**
 * Tacto marketing landing. Built per docs/plans/phase-18-landing-page-rfc.md.
 * Phase 1 = navbar + hero + hero embed. Subsequent sections land in later
 * phases. SSR-first: only the nav, motion wrappers, and the hero embed hydrate.
 */
export const metadata: Metadata = {
  title: { absolute: "Tacto — Step-by-step guides that write themselves" },
  description:
    "Record any workflow once. Tacto turns every click into a polished step-by-step guide, interactive walkthrough, SOP, or branded knowledge base — no editing, no writing.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Tacto — Step-by-step guides that write themselves",
    description:
      "Record any workflow once. Tacto turns it into a step-by-step guide, interactive walkthrough, SOP, or knowledge base — automatically.",
    type: "website",
    siteName: "Tacto",
    url: "/",
  },
  twitter: { card: "summary_large_image" },
}

const SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Tacto",
      url: "https://tacto.fyi",
      description: "AI workflow capture that turns any process into a step-by-step guide.",
    },
    {
      "@type": "WebSite",
      name: "Tacto",
      url: "https://tacto.fyi",
    },
    {
      "@type": "SoftwareApplication",
      name: "Tacto",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, Chrome",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
  ],
}

export default function MarketingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }} />
      <main>
        <Hero />
        <LogoStrip />
        <Timeline />
        <OutputDemo />
        <UseCases />
        <Features />
        <HelpCenter />
        <Manifesto />
        <Faq />
        <Cta />
      </main>
    </>
  )
}
