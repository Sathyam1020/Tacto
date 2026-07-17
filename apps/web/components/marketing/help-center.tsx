import Image from "next/image"
import { BarChart3, Globe, Lock, PanelsTopLeft } from "lucide-react"

import { Reveal } from "@/components/marketing/motion"

/**
 * Help-center overview — a bento anchored by a real screenshot of a live,
 * branded Tacto help center (captured to /public/marketing, served via
 * next/image; object-top crops the dev badge). Server-rendered on a cobalt band
 * for rhythm; reveal wrappers are the only islands.
 */
export function HelpCenter() {
  return (
    <section className="relative overflow-hidden bg-[radial-gradient(130%_130%_at_50%_120%,#6b74dd_0%,#5058bf_55%,#3f469c_100%)] text-white">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-[11px] tracking-widest text-white/60 uppercase">Help center</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.02em] text-balance sm:text-5xl">
            Give every guide a home.
          </h2>
          <p className="mt-4 font-accent text-[21px] text-white/70 sm:text-[24px]">
            Searchable, branded, and hosted on your domain.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-14 grid gap-4 lg:grid-cols-3">
          {/* anchor card — real screenshot */}
          <div className="overflow-hidden rounded-2xl bg-white text-[var(--l-ink)] shadow-xl lg:col-span-2">
            <div className="relative aspect-[16/9] border-b border-[var(--l-hairline)]">
              <Image
                src="/marketing/help-center.png"
                alt="A branded, searchable Tacto help center"
                fill
                className="object-cover object-top"
                sizes="(max-width: 1024px) 100vw, 66vw"
                priority={false}
              />
            </div>
            <div className="p-6">
              <p className="font-mono text-[10px] tracking-widest text-cobalt uppercase">Searchable &amp; branded</p>
              <h3 className="mt-2 font-display text-xl font-semibold tracking-tight">A help center your users actually search</h3>
              <p className="mt-1.5 max-w-lg text-[14px] leading-relaxed text-[var(--l-ink-subtle)]">
                Bring every guide under one roof — with search, categories, and articles — in an afternoon. No CMS, no engineers.
              </p>
            </div>
          </div>

          {/* custom domain card */}
          <HcCard icon={Globe} label="Custom domain" title="Hosted on your domain">
            <div className="mt-4 flex items-center justify-center rounded-xl border border-dashed border-[var(--l-hairline-strong)] bg-[var(--l-canvas)] py-5">
              <span className="font-mono text-[13px] text-[var(--l-ink)]">
                <span className="text-cobalt">help.</span>yourcompany.com
              </span>
            </div>
          </HcCard>

          {/* three feature cards */}
          <HcCard icon={PanelsTopLeft} label="Multi-layout" title="Two layouts, one help center">
            <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--l-ink-subtle)]">
              A clean, searchable layout for customers — or a structured one for a big internal wiki.
            </p>
          </HcCard>
          <HcCard icon={Lock} label="Access" title="Private when it needs to be">
            <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--l-ink-subtle)]">
              Gate internal or sensitive docs behind authentication and share them safely.
            </p>
          </HcCard>
          <HcCard icon={BarChart3} label="Insight" title="See where readers get stuck">
            <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--l-ink-subtle)]">
              Built-in analytics on every article — what they search, what they finish.
            </p>
          </HcCard>
        </Reveal>
      </div>
    </section>
  )
}

function HcCard({
  icon: Icon,
  label,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl bg-white p-6 text-[var(--l-ink)] shadow-xl">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-cobalt">
        <Icon className="size-5" />
      </span>
      <p className="mt-4 font-mono text-[10px] tracking-widest text-cobalt uppercase">{label}</p>
      <h3 className="mt-1 font-display text-[17px] font-semibold tracking-tight">{title}</h3>
      {children}
    </div>
  )
}
