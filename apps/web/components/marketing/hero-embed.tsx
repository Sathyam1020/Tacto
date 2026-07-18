/**
 * The hero's single live proof: a real, published Tacto guide running in
 * interactive mode. The interactive player renders its own window chrome, so we
 * DON'T wrap it in a second frame. Fills its container (wide on desktop,
 * full-width on mobile). One of only two live embeds on the page. Server-
 * rendered; loads eagerly (above the fold).
 */
const DEMO_GUIDE = process.env.NEXT_PUBLIC_DEMO_GUIDE || "uMj-0VML35Pa"

export function HeroEmbed() {
  return (
    <div id="see-it" className="relative mx-auto w-full scroll-mt-24">
      {/* soft cobalt floor glow to lift it off the page */}
      <div aria-hidden className="pointer-events-none absolute inset-x-12 -bottom-6 -z-10 h-24 rounded-full bg-cobalt/25 blur-3xl" />
      <div className="overflow-hidden rounded-2xl border border-[var(--l-hairline)] bg-white shadow-[0_40px_120px_-30px_rgba(20,23,40,0.4)] sm:rounded-3xl">
        <iframe
          src={`/embed/g/${DEMO_GUIDE}?mode=interactive&theme=light`}
          title="A live Tacto guide"
          loading="eager"
          className="block h-[300px] w-full bg-white sm:h-[500px] lg:h-[560px]"
        />
      </div>
    </div>
  )
}
