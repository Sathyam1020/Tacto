import { Reveal } from "@/components/marketing/motion"

/**
 * The proof slot. Pre-launch we have no real customer testimonials, and
 * fabricating them is off the table — so this is an honest brand manifesto plus
 * true product facts, not invented quotes. Swap in a real testimonial wall when
 * they exist. Server-rendered; reveal wrapper is the only island.
 */
const FACTS = ["Free forever plan", "Works in your browser", "30+ languages", "No credit card"]

export function Manifesto() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-3xl px-5 py-24 text-center sm:px-8 sm:py-32">
        <Reveal>
          <p className="font-mono text-[11px] tracking-widest text-cobalt uppercase">Why we built it</p>
          <p className="mt-8 text-[30px] leading-[1.15] font-medium tracking-tight text-balance text-[var(--l-ink)] sm:text-[44px]">
            <span className="font-display font-semibold">Nobody should have to </span>
            <span className="font-accent text-cobalt">explain the same thing twice.</span>
          </p>
          <p className="mx-auto mt-6 max-w-lg text-[15px] leading-relaxed text-[var(--l-ink-subtle)] sm:text-[17px]">
            So we built the tool we wanted: record a task once, and hand over a guide that answers for you —
            forever, in any language, wherever your team works.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
            {FACTS.map((f) => (
              <span key={f} className="rounded-full border border-[var(--l-hairline)] bg-white px-3.5 py-1.5 text-[13px] font-medium text-[var(--l-ink-subtle)]">
                {f}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
