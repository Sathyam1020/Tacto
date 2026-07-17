/**
 * Reach strip. Pre-launch we have no customer logos to show, and fabricating
 * them would be dishonest — so this is a truthful "works everywhere" row of the
 * real platforms Tacto publishes and embeds into. Swap for real customer logos
 * once they exist (the marquee is logo-agnostic). SSR; CSS-only marquee.
 */
const PLATFORMS = [
  "Notion",
  "Slack",
  "Confluence",
  "Zendesk",
  "Intercom",
  "Linear",
  "WordPress",
  "HubSpot",
  "Framer",
  "Webflow",
]

export function LogoStrip() {
  const row = [...PLATFORMS, ...PLATFORMS]
  return (
    <section className="border-y border-[var(--l-hairline)] bg-white py-10">
      <p className="mb-7 text-center font-mono text-[11px] tracking-widest text-[var(--l-ink-tertiary)] uppercase">
        Publishes &amp; embeds anywhere your team already works
      </p>
      <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
        <div className="mkt-marquee flex w-max items-center gap-16">
          {row.map((l, i) => (
            <span key={i} className="text-[19px] font-semibold tracking-tight whitespace-nowrap text-[var(--l-ink)]/40">
              {l}
            </span>
          ))}
        </div>
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html:
            "@keyframes mkt-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}" +
            ".mkt-marquee{animation:mkt-marquee 48s linear infinite}" +
            "@media(prefers-reduced-motion:reduce){.mkt-marquee{animation:none}}",
        }}
      />
    </section>
  )
}
