"use client"

import * as React from "react"
import { DownloadIcon } from "@workspace/ui/components/download"

import { Button } from "@workspace/ui/components/button"
import { LogoMark } from "@workspace/ui/components/logo"
import { cn } from "@workspace/ui/lib/utils"

import { layoutMaxWidthClass } from "@/components/guide-customization-context"
import { GuideFeedback } from "@/components/guide-feedback"
import { GuideBody, ViewModeToggle, type ViewMode } from "@/components/guide-view"
import { guideFontFamily } from "@/lib/guide-fonts"
import { resolveCustomization } from "@/lib/guides"
import { downloadGuidePdf } from "@/lib/pdf"
import type { PublicGuide } from "@/lib/public-guide"

/**
 * Public guide reader — a standalone editorial page (no app chrome). This is
 * also marketing: every shared guide shows the Tacto mark.
 */
export function PublicGuideView({ guide }: { guide: PublicGuide }) {
  const cust = React.useMemo(
    () => resolveCustomization(guide.customization),
    [guide.customization]
  )
  const dv = cust.general.defaultView
  const lockedMode: ViewMode | null =
    dv === "only-scroll" ? "list" : dv === "only-walkthrough" ? "interactive" : null
  const [mode, setMode] = React.useState<ViewMode>(
    dv === "walkthrough-default" || dv === "only-walkthrough"
      ? "interactive"
      : "list"
  )
  const effectiveMode = lockedMode ?? mode
  const width = layoutMaxWidthClass(cust.general.pageLayout)
  const stepCount = guide.blocks.filter((b) => b.type === "STEP").length

  return (
    <div
      className="min-h-svh"
      dir={cust.brand.rtl ? "rtl" : undefined}
      style={
        {
          ["--primary" as string]: cust.brand.color,
          fontFamily: guideFontFamily(cust.brand.font),
        } as React.CSSProperties
      }
    >
      <header className="border-b">
        <div className={cn("mx-auto flex h-14 items-center justify-between px-6", width)}>
          {cust.brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cust.brand.logoUrl}
              alt={guide.workspaceName}
              className="h-6 w-auto max-w-[180px] object-contain"
            />
          ) : (
            <div className="flex items-center gap-2">
              <LogoMark className="size-5" />
              <span className="text-muted-foreground font-mono text-xs">
                {guide.workspaceName}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            {!lockedMode && <ViewModeToggle mode={mode} onChange={setMode} />}
            <Button
              size="sm"
              variant="outline"
              onClick={() => void downloadGuidePdf(guide)}
            >
              <DownloadIcon size={15} />
              PDF
            </Button>
          </div>
        </div>
      </header>

      <main className={cn("mx-auto px-6 py-14", width)}>
        <h1 className="font-serif text-4xl font-medium leading-tight tracking-tight text-balance">
          {guide.title}
        </h1>
        {guide.summary && (
          <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
            {guide.summary}
          </p>
        )}
        <p className="text-muted-foreground mt-4 border-b pb-6 font-mono text-xs">
          {stepCount} steps
        </p>

        <div className="mt-10">
          <GuideBody
            blocks={guide.blocks}
            mode={effectiveMode}
            customization={cust}
          />
        </div>

        <GuideFeedback
          shareId={guide.shareId}
          allowReactions={cust.feedback.allowReactions}
          allowComments={cust.feedback.allowComments}
          initialReactions={guide.reactions}
          initialComments={guide.comments}
        />

        <footer className="mt-20 border-t pt-8 text-center">
          <a
            href="/"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 font-mono text-xs transition-colors"
          >
            <LogoMark className="size-4" />
            Made with Tacto
          </a>
        </footer>
      </main>
    </div>
  )
}
