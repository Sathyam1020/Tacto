import Link from "next/link"

import { LogoMark } from "@workspace/ui/components/logo"

/**
 * Production marketing footer — a dark, five-column footer that closes the light
 * page with contrast. The Compare column doubles as the entry point to the
 * programmatic vs/alternative pages (RFC phase-17). SSR; link hrefs are
 * placeholders until the corresponding pages ship.
 */
const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Solutions", href: "/solutions" },
      { label: "Pricing", href: "/pricing" },
      { label: "Showcases", href: "/showcase" },
      { label: "Help center", href: "/help" },
      { label: "Chrome extension", href: "/chrome" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Docs", href: "/docs" },
      { label: "Changelog", href: "/changelog" },
      { label: "Media kit", href: "/media-kit" },
      { label: "Contact us", href: "/contact" },
    ],
  },
  {
    heading: "Compare",
    links: [
      { label: "Tacto vs Scribe", href: "/compare/scribe" },
      { label: "Tacto vs Guidejar", href: "/compare/guidejar" },
      { label: "Tacto vs Supademo", href: "/compare/supademo" },
      { label: "Tacto vs Tango", href: "/compare/tango" },
      { label: "Tacto vs Arcade", href: "/compare/arcade" },
      { label: "Tacto vs Guidde", href: "/compare/guidde" },
      { label: "Tacto vs Storylane", href: "/compare/storylane" },
      { label: "See all comparisons", href: "/compare" },
    ],
  },
  {
    heading: "Free tools",
    links: [
      { label: "SOP creator", href: "/tools/sop-creator" },
      { label: "Step-by-step guide maker", href: "/tools/step-by-step-guide-maker" },
      { label: "Screenshot annotator", href: "/tools/screenshot-annotator" },
      { label: "Screen recorder", href: "/tools/screen-recorder" },
      { label: "GIF maker", href: "/tools/gif-maker" },
      { label: "QR code generator", href: "/tools/qr-code-generator" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Terms of service", href: "/legal/terms" },
      { label: "Privacy policy", href: "/legal/privacy" },
      { label: "Cookie policy", href: "/legal/cookies" },
      { label: "GDPR", href: "/legal/gdpr" },
      { label: "Security", href: "/legal/security" },
    ],
  },
]

export function Footer() {
  return (
    <footer className="bg-[#0b0c10] text-white">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <p className="font-mono text-[11px] tracking-widest text-white/40 uppercase">{col.heading}</p>
              <ul className="mt-4 flex flex-col gap-3 text-[13.5px]">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-white/65 transition-colors hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-16 flex flex-col gap-5 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-white/10">
              <LogoMark className="size-5 text-white" />
            </span>
            <span className="font-display text-[16px] font-semibold tracking-tight">Tacto</span>
            <span className="text-[13px] text-white/40">© 2026 · All rights reserved</span>
          </div>
          <div className="flex items-center gap-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12.5px] font-medium text-white/70">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#27a644] opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-[#27a644]" />
              </span>
              All systems operational
            </span>
            <span className="font-mono text-[12.5px] text-white/40">tacto.fyi</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
