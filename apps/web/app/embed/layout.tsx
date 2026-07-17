import * as React from "react"

/**
 * Chromeless layout for embeddable surfaces. A blocking inline script applies
 * the `?theme=light|dark|auto` choice before first paint (auto → the host's
 * prefers-color-scheme), so a framed embed never flashes the app's default
 * theme. `EmbedTheme` keeps it in sync after hydration.
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){try{var p=new URLSearchParams(location.search).get('theme')||'auto';" +
            "var d=p==='dark'||(p!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);" +
            "document.documentElement.classList.toggle('dark',d);}catch(e){}})();",
        }}
      />
      {children}
    </>
  )
}
