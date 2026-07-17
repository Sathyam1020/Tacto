import {
  AudioLines,
  BarChart3,
  Download,
  EyeOff,
  FileText,
  Languages,
  Layers,
  Lock,
  MousePointerClick,
} from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

import { Item, Reveal, StaggerReveal } from "@/components/marketing/motion"

/**
 * Feature masonry — a varied-width bento so the grid never reads as a uniform
 * list. Server-rendered; the reveal wrappers are the only islands. Followed by a
 * compact, honest integrations row (real embed targets).
 */
const FEATURES = [
  { icon: FileText, title: "Step-by-step guides", body: "AI turns every captured action into one clear, imperative step — with the exact click spotlit on the screenshot.", wide: true },
  { icon: MousePointerClick, title: "Interactive walkthroughs", body: "Click-through demos that feel like the real product." },
  { icon: AudioLines, title: "AI voiceover", body: "Natural, on-brand narration in seconds." },
  { icon: Languages, title: "Instant translation", body: "Publish the same guide in 30+ languages — narration and captions included, no re-recording.", wide: true },
  { icon: Download, title: "PDF & video export", body: "One click to a branded PDF or a 1080p video." },
  { icon: Layers, title: "Chapters & branching", body: "Group steps into chapters; branch for different paths." },
  { icon: EyeOff, title: "Blur & redact", body: "Hide sensitive data with a single click." },
  { icon: BarChart3, title: "Engagement analytics", body: "Views, completion, and step-by-step drop-off — per guide, so you know which docs actually work.", wide: true },
  { icon: Lock, title: "Access control", body: "Role-based permissions and private links." },
]

const INTEGRATIONS = ["Notion", "Confluence", "Zendesk", "Intercom", "Slack", "WordPress", "HubSpot", "Framer"]

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 border-y border-[var(--l-hairline)] bg-[var(--l-canvas)]">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-[11px] tracking-widest text-cobalt uppercase">Features</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.02em] text-balance text-[var(--l-ink)] sm:text-5xl">
            Simple to use. Hard to outgrow.
          </h2>
        </Reveal>

        <StaggerReveal className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" gap={0.06}>
          {FEATURES.map((f) => (
            <Item key={f.title} className={cn(f.wide && "lg:col-span-2")}>
              <div className="group h-full rounded-2xl border border-[var(--l-hairline)] bg-white p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_20px_44px_-28px_rgba(20,23,40,0.35)]">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-cobalt transition-transform duration-300 group-hover:scale-105">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-display text-[17px] font-semibold tracking-tight text-[var(--l-ink)]">{f.title}</h3>
                <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-[var(--l-ink-subtle)]">{f.body}</p>
              </div>
            </Item>
          ))}
        </StaggerReveal>

        {/* integrations */}
        <Reveal delay={0.15} className="mt-14 flex flex-col items-center gap-6 border-t border-[var(--l-hairline)] pt-12">
          <p className="font-accent text-lg text-[var(--l-ink-subtle)]">Embed anywhere on the web —</p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
            {INTEGRATIONS.map((n) => (
              <span key={n} className="text-[16px] font-semibold tracking-tight whitespace-nowrap text-[var(--l-ink)]/45">
                {n}
              </span>
            ))}
            <span className="text-[14px] text-[var(--l-ink-tertiary)]">&amp; more</span>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
