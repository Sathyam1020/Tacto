/**
 * The hero's single live proof: a real, published Tacto guide running in
 * interactive mode. The interactive player renders its own browser frame +
 * controls, so we DON'T wrap it in a second frame (that produced a
 * frame-in-a-frame). One of only two live embeds on the page (RFC — no "embed
 * slop"). Server-rendered; loads eagerly (above the fold). Env-configurable.
 */
const DEMO_GUIDE = process.env.NEXT_PUBLIC_DEMO_GUIDE || "uMj-0VML35Pa"

export function HeroEmbed() {
  return (
    <div id="see-it" className="relative mx-auto max-w-4xl scroll-mt-24">
      {/* soft floor glow */}
      <div aria-hidden className="pointer-events-none absolute inset-x-8 -bottom-6 -z-10 h-24 rounded-full bg-cobalt/20 blur-3xl" />
      <div className="overflow-hidden rounded-2xl border border-[var(--l-hairline)] bg-white shadow-[0_40px_120px_-30px_rgba(20,23,40,0.35)]">
        <iframe
          src={`/embed/g/${DEMO_GUIDE}?mode=interactive&theme=light`}
          title="A live Tacto guide"
          loading="eager"
          className="block h-[480px] w-full bg-white sm:h-[560px]"
        />
      </div>
    </div>
  )
}
