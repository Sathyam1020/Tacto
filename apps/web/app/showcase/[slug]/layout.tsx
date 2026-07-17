import * as React from "react"

/**
 * The public Showcase viewer is intentionally light-only (like the guide reader
 * and Help Center), but the app defaults to a `.dark` class that next-themes
 * sets pre-paint. This blocking inline script strips `.dark` before the content
 * paints, so there's no dark→light flash — and no dark-mode ink stranded on the
 * forced-white background. (Client-side navigation is handled by the
 * force-light effect inside `ShowcaseView`, which also restores `.dark` on
 * leave. The embed variant lives under a different layout and keeps its theme.)
 */
export default function ShowcaseLayout({ children }: { children: React.ReactNode }) {
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
