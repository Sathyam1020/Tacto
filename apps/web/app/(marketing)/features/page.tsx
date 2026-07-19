import type { Metadata } from "next"
import {
  BarChart3,
  Boxes,
  ClipboardList,
  Crosshair,
  FileDown,
  Languages,
  LayoutGrid,
  MonitorPlay,
  MousePointerClick,
  Search,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react"

import { Cta } from "@/components/marketing/cta"
import { Item, StaggerReveal } from "@/components/marketing/motion"
import { PageHero } from "@/components/marketing/page-hero"
import { pageMeta } from "@/lib/marketing/seo"

export const metadata: Metadata = pageMeta({
  title: "Features — step-by-step guides, walkthroughs & help center",
  description:
    "Everything Tacto does: browser capture, AI-written steps, interactive walkthroughs, a branded help center, showcases, forms, analytics, voice-over, translations, redaction, and export.",
  path: "/features",
})

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: MonitorPlay, title: "Browser capture", body: "Record any workflow from your browser. Every click, field, and page change becomes a step — with the screenshot from that exact moment." },
  { icon: Sparkles, title: "AI-written steps", body: "The AI reads your capture and writes one clear instruction per action, dropping the mis-clicks and dead ends automatically." },
  { icon: Crosshair, title: "Click pointer & spotlight", body: "The precise click is marked on every screenshot, so readers see exactly where to go — no guessing." },
  { icon: MousePointerClick, title: "Interactive walkthroughs", body: "Turn any capture into a spotlighted, click-through demo that viewers drive themselves, at their own pace." },
  { icon: Search, title: "Branded help center", body: "Publish guides to a searchable knowledge base on your own domain, grouped into collections your customers can navigate." },
  { icon: LayoutGrid, title: "Showcases", body: "Curate guides into branded, embeddable collections for onboarding flows, demo galleries, and landing pages." },
  { icon: ClipboardList, title: "Forms", body: "Collect answers inside a guide — qualify a lead, gather feedback, or gate a step — without leaving the walkthrough." },
  { icon: BarChart3, title: "Analytics", body: "See views, completion, and drop-off per guide, so you know what's working and where readers stall." },
  { icon: MonitorPlay, title: "Voice-over narration", body: "Add AI narration to a walkthrough so it plays like a guided video — in your language, from the same capture." },
  { icon: Languages, title: "Translations", body: "Publish one capture in multiple languages, so distributed teams and customers read in their own." },
  { icon: ShieldCheck, title: "PII redaction", body: "Blur any region manually, or auto-redact PII, so sensitive data never leaves your screen recordings." },
  { icon: FileDown, title: "PDF & MP4 export", body: "Export a guide as a clean PDF or an MP4 video — the same recording, in whatever format your audience wants." },
]

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Features"
        title="Everything you need to document how it's done."
        subtitle="Simple to use. Hard to outgrow."
      />
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <StaggerReveal className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Item key={f.title}>
                <div className="flex h-full flex-col rounded-3xl border border-[var(--l-hairline)] bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(20,23,40,0.3)]">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-cobalt">
                    <f.icon className="size-6" />
                  </span>
                  <h2 className="mt-5 font-display text-lg font-semibold tracking-tight text-[var(--l-ink)]">{f.title}</h2>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--l-ink-subtle)]">{f.body}</p>
                </div>
              </Item>
            ))}
          </StaggerReveal>
        </div>
      </section>
      <Cta />
    </>
  )
}
