"use client"

import { Puzzle, RefreshCw } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { LogoMark } from "@workspace/ui/components/logo"

import type { ExtensionState } from "@/lib/extension"

/**
 * Gate shown until the Tacto extension is installed AND connected. Capturing
 * workflows is the whole product, so the app requires the extension.
 */
export function ExtensionOnboarding({ state }: { state: ExtensionState }) {
  const installed = state === "not-connected"

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center px-6 text-center">
      <LogoMark className="size-10" />
      <h1 className="mt-8 font-serif text-3xl font-medium tracking-tight text-balance">
        {installed ? "Connect your extension" : "Install the Tacto extension"}
      </h1>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
        {installed
          ? "One click links the extension to your workspace. Then you can capture any tab."
          : "Tacto captures workflows through a Chrome extension. Add it to get started."}
      </p>

      {installed ? (
        <Button
          size="lg"
          className="mt-8"
          onClick={() => {
            window.location.href = "/extension/connect"
          }}
        >
          <Puzzle className="size-4" />
          Connect extension
        </Button>
      ) : (
        <div className="mt-8 w-full text-left">
          <ol className="text-muted-foreground flex flex-col gap-3 text-sm">
            <li>
              1. Open <span className="font-mono text-xs">chrome://extensions</span>,
              enable <strong className="text-foreground">Developer mode</strong>.
            </li>
            <li>
              2. Click <strong className="text-foreground">Load unpacked</strong> and
              select the Tacto extension folder.
            </li>
            <li>3. Come back here and refresh.</li>
          </ol>
          <Button
            variant="outline"
            size="lg"
            className="mt-8 w-full"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="size-4" />
            I&apos;ve installed it — refresh
          </Button>
        </div>
      )}
    </div>
  )
}
