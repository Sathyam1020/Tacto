import type { Metadata } from "next"
import { Geist_Mono, Newsreader, Schibsted_Grotesk } from "next/font/google"

import "@workspace/ui/globals.css"
import { cn } from "@workspace/ui/lib/utils"

import { Providers } from "@/components/providers"
import { ThemeProvider } from "@/components/theme-provider"

/**
 * Tacto type roles:
 *  - sans  (Schibsted Grotesk): UI chrome — nav, buttons, settings, metadata labels.
 *  - serif (Newsreader):        the knowledge itself — guide titles, step text, viewer.
 *  - mono  (Geist Mono):        captured data — timestamps, URLs, element labels, kbd.
 */
const fontSans = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontSerif = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-serif",
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
        fontSerif.variable,
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
