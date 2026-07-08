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
    <div className="flex min-h-svh flex-col">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
        <Link href="/" aria-label="Tacto home" className="mb-10 inline-block">
          <LogoMark className="size-8" />
        </Link>
        {children}
      </main>
      <footer className="pb-8 text-center font-mono text-xs text-muted-foreground">
        Tacto · capture once, teach forever
      </footer>
    </div>
  )
}
