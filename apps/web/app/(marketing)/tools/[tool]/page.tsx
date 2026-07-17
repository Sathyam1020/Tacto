import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, Check } from "lucide-react"

import { ToolShell } from "@/components/marketing/tool-shell"
import { GifMakerTool } from "@/components/marketing/tools/gif-maker-tool"
import { QrCodeTool } from "@/components/marketing/tools/qr-code-tool"
import { ScreenRecorderTool } from "@/components/marketing/tools/screen-recorder-tool"
import { ScreenshotAnnotatorTool } from "@/components/marketing/tools/screenshot-annotator-tool"
import { SopCreatorTool } from "@/components/marketing/tools/sop-creator-tool"
import { getTool, TOOLS } from "@/lib/marketing/tools"
import { pageMeta } from "@/lib/marketing/seo"

type Params = { params: Promise<{ tool: string }> }

export function generateStaticParams() {
  return TOOLS.map((t) => ({ tool: t.slug }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { tool } = await params
  const t = getTool(tool)
  if (!t) return {}
  return pageMeta({ title: t.name, description: t.description, path: `/tools/${t.slug}` })
}

const UI: Record<string, React.ReactNode> = {
  "qr-code-generator": <QrCodeTool />,
  "screenshot-annotator": <ScreenshotAnnotatorTool />,
  "screen-recorder": <ScreenRecorderTool />,
  "sop-creator": <SopCreatorTool />,
  "gif-maker": <GifMakerTool />,
}

/** Funnel body for the guide-maker (the tool is the product itself). */
function GuideMakerFunnel() {
  const steps = [
    "Install the Tacto browser extension.",
    "Hit record and click through your workflow once.",
    "Tacto writes the steps and marks every click — your guide is ready to share.",
  ]
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-[16.5px] leading-relaxed text-[var(--l-ink-subtle)]">
        The fastest way to make a step-by-step guide is to not write one. Record any browser workflow and Tacto&apos;s AI
        turns it into a polished, screenshot-by-screenshot guide — free to start.
      </p>
      <ul className="mx-auto mt-8 flex max-w-md flex-col gap-3 text-left">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-3 rounded-2xl border border-[var(--l-hairline)] bg-white p-4">
            <span className="flex size-7 flex-none items-center justify-center rounded-lg bg-primary/10 font-mono text-[12px] font-semibold text-cobalt">
              {i + 1}
            </span>
            <span className="text-[14.5px] leading-relaxed text-[var(--l-ink)]">{s}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-[14px] font-semibold text-white transition-transform hover:scale-[1.02]">
          Make a guide free <ArrowRight className="size-4" />
        </Link>
        <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--l-ink-subtle)]">
          <Check className="size-4 text-cobalt" /> No credit card
        </span>
      </div>
    </div>
  )
}

export default async function ToolPage({ params }: Params) {
  const { tool } = await params
  const t = getTool(tool)
  if (!t) notFound()

  const schema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: `${t.name} — Tacto`,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description: t.description,
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <ToolShell tool={t}>{t.interactive ? UI[t.slug] : <GuideMakerFunnel />}</ToolShell>
    </>
  )
}
