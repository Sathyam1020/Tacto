import type { Metadata } from "next"
import { Geist, Geist_Mono, Newsreader } from "next/font/google"

import "@workspace/ui/globals.css"
import { cn } from "@workspace/ui/lib/utils"

import { Providers } from "@/components/providers"
import { ThemeProvider } from "@/components/theme-provider"

/**
 * Tacto type roles:
 *  - sans  (Geist):        UI chrome AND reading text — comfortable, legible.
 *  - serif (Newsreader):   display only — guide titles, page headings, heroes.
 *  - mono  (Geist Mono):   captured data — timestamps, URLs, element labels.
 *
 * Serif is reserved for large display sizes where it reads as editorial;
 * body/instructional text is sans so following a guide never strains.
 */
const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontSerif = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
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
