"use client"

import * as React from "react"
import { Download } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { LogoMark } from "@workspace/ui/components/logo"

import { GuideBody, ViewModeToggle, type ViewMode } from "@/components/guide-view"
import { downloadGuidePdf } from "@/lib/pdf"
import type { PublicGuide } from "@/lib/public-guide"

/**
 * Public guide reader — a standalone editorial page (no app chrome). This is
 * also marketing: every shared guide shows the Tacto mark.
 */
export function PublicGuideView({ guide }: { guide: PublicGuide }) {
  const [mode, setMode] = React.useState<ViewMode>("list")
  const stepCount = guide.blocks.filter((b) => b.type === "STEP").length

  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <LogoMark className="size-5" />
            <span className="text-muted-foreground font-mono text-xs">
              {guide.workspaceName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ViewModeToggle mode={mode} onChange={setMode} />
            <Button
              size="sm"
              variant="outline"
              onClick={() => void downloadGuidePdf(guide)}
            >
              <Download className="size-3.5" />
              PDF
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-14">
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
          <GuideBody blocks={guide.blocks} mode={mode} />
        </div>

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
