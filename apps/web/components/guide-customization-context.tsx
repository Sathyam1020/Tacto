"use client"

import * as React from "react"

import {
  DEFAULT_CUSTOMIZATION,
  type GuideCustomization,
} from "@workspace/contracts/guide"

/**
 * Provides the resolved published-view customization to the guide renderers
 * (block-view, interactive-view, screenshot-frame) without prop-drilling.
 * Defaults are used outside a provider (e.g. the editor preview).
 */
const GuideCustomizationContext =
  React.createContext<GuideCustomization>(DEFAULT_CUSTOMIZATION)

export function GuideCustomizationProvider({
  value,
  children,
}: {
  value: GuideCustomization
  children: React.ReactNode
}) {
  return (
    <GuideCustomizationContext.Provider value={value}>
      {children}
    </GuideCustomizationContext.Provider>
  )
}

export function useGuideCustomization(): GuideCustomization {
  return React.useContext(GuideCustomizationContext)
}

/** The guide's brand logo, shown above the title when one is uploaded. */
export function GuideBrandLogo({ url }: { url: string | null }) {
  if (!url) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="mb-6 h-10 w-auto max-w-[220px] object-contain"
    />
  )
}

/** Tailwind max-width for the page-layout width setting. */
export function layoutMaxWidthClass(
  layout: GuideCustomization["general"]["pageLayout"]
): string {
  switch (layout) {
    case "extremely-narrow":
      return "max-w-lg"
    case "narrow":
      return "max-w-xl"
    case "moderate":
      return "max-w-3xl"
    case "wide":
      return "max-w-5xl"
    case "extremely-wide":
      return "max-w-7xl"
  }
}
