import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import "@workspace/ui/globals.css"
import { cn } from "@workspace/ui/lib/utils"

import { Providers } from "@/components/providers"
import { ThemeProvider } from "@/components/theme-provider"

/**
 * Datum type roles (grotesque-led — hierarchy from scale, not serifs):
 *  - sans (Geist):     the whole interface AND reading text.
 *  - mono (Geist Mono): captured data — timestamps, URLs, labels, shortcuts.
 *
 * `--font-serif` is aliased to Geist in globals.css so any legacy font-serif
 * usage renders as the grotesque until those call sites are migrated. A real
 * display serif (Canela) can be slotted in for hero moments once licensed.
 */
const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: {
    default: "Tacto",
    template: "%s · Tacto",
  },
  description:
    "Capture a workflow once. Tacto turns it into guides, walkthroughs, and documentation.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        "font-sans",
        fontSans.variable,
        fontMono.variable
      )}
    >
      <body>
        <ThemeProvider>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
