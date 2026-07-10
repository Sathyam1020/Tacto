import Link from "next/link"

import { LogoMark } from "@workspace/ui/components/logo"

/**
 * Auth shell — editorial, not a card floating on gray. A narrow centered
 * column on paper; the mark above, mono footer below.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="flex min-h-svh flex-col"
      style={{
        backgroundColor: "var(--background)",
        // The Datum drafting canvas: soft top light + a barely-there dot grid.
        backgroundImage:
          "radial-gradient(120% 70% at 50% -10%, rgba(255,255,255,0.6), transparent 60%), radial-gradient(rgba(27,29,34,0.05) 1px, transparent 1.4px)",
        backgroundSize: "auto, 26px 26px",
        backgroundAttachment: "fixed, fixed",
      }}
    >
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
        <Link href="/" aria-label="Tacto home" className="mb-10 inline-block">
          <LogoMark className="size-8" />
        </Link>
        {children}
      </main>
      <footer className="text-muted-foreground pb-8 text-center font-mono text-xs">
        Tacto · capture once, teach forever
      </footer>
    </div>
  )
}
