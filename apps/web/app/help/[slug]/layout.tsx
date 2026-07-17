import * as React from "react"

import { PublicThemeProvider, PUBLIC_THEME_PREPAINT } from "@/lib/public-theme"

/**
 * The public Help Center supports light + dark via a visitor-owned theme
 * (independent of the app's next-themes default). The blocking inline script
 * applies the saved choice before paint (no flash); `PublicThemeProvider` holds
 * it against next-themes and drives the header toggle.
 */
export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PUBLIC_THEME_PREPAINT }} />
      <PublicThemeProvider>{children}</PublicThemeProvider>
    </>
  )
}
