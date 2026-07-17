import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Reveal } from "@/components/marketing/motion"

/** Closing call to action — a full-bleed cobalt band. Server-rendered. */
export function Cta() {
  return (
    <section className="relative overflow-hidden bg-[radial-gradient(120%_150%_at_50%_-20%,#6b74dd_0%,#5058bf_55%,#3f469c_100%)] text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "26px 26px" }} />
      <div className="mx-auto max-w-3xl px-5 py-24 text-center sm:px-8 sm:py-28">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold tracking-[-0.02em] text-balance sm:text-[52px] sm:leading-[1.05]">
            Stop explaining the same thing twice.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-[15px] text-white/75 sm:text-[17px]">
            Record it once with Tacto. Hand over a guide that answers for you — forever.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-[15px] font-semibold text-cobalt shadow-[0_16px_40px_-16px_rgba(0,0,0,0.5)] transition-transform duration-200 hover:scale-[1.02]"
            >
              Start for free <ArrowRight className="size-4" />
            </Link>
            <Link href="/sign-in" className="text-[15px] font-medium text-white/80 transition-colors hover:text-white">
              Log in
            </Link>
          </div>
          <p className="mt-5 font-mono text-[11px] tracking-wide text-white/50 uppercase">
            Free forever · No credit card · Live in under a minute
          </p>
        </Reveal>
      </div>
    </section>
  )
}
