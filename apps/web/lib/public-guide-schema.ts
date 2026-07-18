import type { PublicGuide } from "@/lib/public-guide"

/** Strip HTML tags + decode the handful of entities our rich text emits, so a
 *  block's content becomes clean plain text for structured data. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&apos;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim()
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s
}

/**
 * Build schema.org JSON-LD for a published guide: a `HowTo` (with a `HowToStep`
 * per captured step, its screenshot as the step image) and, when the guide has
 * FAQs, a `FAQPage`. Returns null when there's nothing rich to describe (no
 * steps and no FAQs), so the page just falls back to the article OG tags.
 *
 * This is what earns rich how-to results in search and makes guides citable by
 * AI answer engines — the core of the per-guide pSEO/AEO play.
 */
export function buildGuideJsonLd(
  guide: PublicGuide,
  opts?: { idUrl?: string }
): Record<string, unknown> | null {
  const steps = guide.blocks.filter((b) => b.type === "STEP")

  const graph: Record<string, unknown>[] = []

  if (steps.length > 0) {
    const howToSteps = steps.map((b, i) => {
      const text = stripHtml(b.content) || `Step ${i + 1}`
      const step: Record<string, unknown> = {
        "@type": "HowToStep",
        position: i + 1,
        name: truncate(text, 80),
        text,
      }
      if (b.screenshotUrl) step.image = b.screenshotUrl
      return step
    })
    const firstImage = steps.find((b) => b.screenshotUrl)?.screenshotUrl
    graph.push({
      "@type": "HowTo",
      // Only anchor an @id when the caller knows the canonical URL (the tacto.fyi
      // /g page). Help centers can be on customer domains — omit it there.
      ...(opts?.idUrl ? { "@id": opts.idUrl } : {}),
      name: guide.title,
      description: guide.summary ?? `A step-by-step guide by ${guide.workspaceName}.`,
      ...(firstImage ? { image: firstImage } : {}),
      ...(guide.publishedAt ? { datePublished: guide.publishedAt } : {}),
      totalTime: `PT${Math.max(1, steps.length)}M`,
      step: howToSteps,
      publisher: { "@type": "Organization", name: guide.workspaceName },
    })
  }

  if (guide.faqs.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: guide.faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: stripHtml(f.answer) },
      })),
    })
  }

  if (graph.length === 0) return null
  return { "@context": "https://schema.org", "@graph": graph }
}
