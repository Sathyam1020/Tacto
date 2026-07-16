import * as React from "react"

/**
 * The public Help Center is intentionally light-only, but the app defaults to a
 * `.dark` class that next-themes sets pre-paint. This blocking inline script
 * strips `.dark` before the help content paints, so there's no dark→light flash
 * on a full page load. (Client-side navigation is handled by `useForceLight`,
 * which also restores `.dark` when leaving for the app.)
 */
export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: "try{document.documentElement.classList.remove('dark')}catch(e){}",
        }}
      />
      {children}
    </>
  )
}
