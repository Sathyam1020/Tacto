import type { Metadata } from "next"
import { Bricolage_Grotesque, Instrument_Serif } from "next/font/google"

import { cn } from "@workspace/ui/lib/utils"

import { Footer } from "@/components/marketing/footer"
import { LightLock } from "@/components/marketing/light-lock"
import { MarketingNav } from "@/components/marketing/nav"

/**
 * Marketing shell. Loads the two marketing-only type roles (kept off every app
 * route) and locks the surface to light. Server component — only <LightLock/>
 * hydrates. Fonts are self-hosted by next/font (no CDN, no CLS).
 *
 *  - Display: Bricolage Grotesque — characterful grotesque for headlines.
 *  - Accent:  Instrument Serif (italic) — editorial sub-taglines.
 *  (Body/UI keeps Geist, mono keeps Geist Mono, inherited from the root shell.)
 */
const fontDisplay = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700"],
})
const fontAccent = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-accent",
  weight: "400",
  style: "italic",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL("https://tacto.fyi"),
}

const PREPAINT = "try{document.documentElement.classList.remove('dark')}catch(e){}"

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PREPAINT }} />
      <LightLock />
      <div className={cn(fontDisplay.variable, fontAccent.variable, "bg-white text-[var(--l-ink)] antialiased")}>
        <MarketingNav />
        {children}
        <Footer />
      </div>
    </>
  )
}
