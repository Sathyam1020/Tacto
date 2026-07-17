import type { Metadata } from "next"

import { Reveal } from "@/components/marketing/motion"
import { PageHero } from "@/components/marketing/page-hero"
import { formatDate } from "@/lib/marketing/blog"
import { pageMeta } from "@/lib/marketing/seo"

export const metadata: Metadata = pageMeta({
  title: "Changelog",
  description: "What's new in Tacto — the latest features, improvements, and fixes.",
  path: "/changelog",
})

type Release = { date: string; tag: "New" | "Improved" | "Fixed"; title: string; body: string }

const RELEASES: Release[] = [
  {
    date: "2026-07-15",
    tag: "Improved",
    title: "Interactive walkthroughs, redesigned",
    body: "The interactive player is now full-bleed, with a spotlight that dims everything except the next click and clean edge-to-edge navigation. It reads like a real product demo, not a boxed viewer.",
  },
  {
    date: "2026-07-08",
    tag: "Improved",
    title: "List view rebuilt as cards",
    body: "Scroll (list) mode now presents each step as a standalone card — number and instruction on top, screenshot below — for a cleaner, more scannable read.",
  },
  {
    date: "2026-06-20",
    tag: "New",
    title: "AI-generated FAQs on every guide",
    body: "Tacto now suggests the questions readers are most likely to ask about a guide and drafts the answers, so your docs are complete without extra writing.",
  },
  {
    date: "2026-05-28",
    tag: "New",
    title: "Guide analytics",
    body: "See views, completion, and drop-off for every guide. Find the step where readers stall and fix the ones that matter.",
  },
  {
    date: "2026-05-12",
    tag: "New",
    title: "Forms inside guides",
    body: "Collect answers without leaving a walkthrough — qualify a lead, gather feedback, or gate a step, right in the flow.",
  },
  {
    date: "2026-04-18",
    tag: "New",
    title: "Showcases",
    body: "Curate guides into branded, embeddable collections — perfect for onboarding flows, demo galleries, and landing pages.",
  },
  {
    date: "2026-03-22",
    tag: "New",
    title: "Help center on a custom domain",
    body: "Publish a searchable, branded knowledge base on your own domain, grouped into collections your customers can navigate.",
  },
  {
    date: "2026-02-14",
    tag: "New",
    title: "Click pointer & spotlight",
    body: "Every screenshot now marks the exact click, so readers always know where to go. Captured automatically from the recording.",
  },
]

const TAG_STYLE: Record<Release["tag"], string> = {
  New: "bg-primary/10 text-cobalt",
  Improved: "bg-[var(--l-success)]/12 text-[var(--l-success)]",
  Fixed: "bg-amber-500/12 text-amber-600",
}

export default function ChangelogPage() {
  return (
    <>
      <PageHero eyebrow="Changelog" title="What's new in Tacto." subtitle="Shipped, and worth telling you about." />
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8 sm:py-24">
          <ol className="relative border-l border-[var(--l-hairline)]">
            {RELEASES.map((r) => (
              <li key={r.date + r.title} className="relative pb-12 pl-8 last:pb-0">
                <span className="absolute top-1.5 -left-[6.5px] size-3 rounded-full border-2 border-white bg-primary shadow-sm" />
                <Reveal>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-[12px] tracking-wide text-[var(--l-ink-tertiary)]">{formatDate(r.date)}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TAG_STYLE[r.tag]}`}>{r.tag}</span>
                  </div>
                  <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-[var(--l-ink)]">{r.title}</h2>
                  <p className="mt-2 text-[15px] leading-relaxed text-[var(--l-ink-subtle)]">{r.body}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  )
}
