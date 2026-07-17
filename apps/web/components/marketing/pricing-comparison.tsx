import { Fragment } from "react"
import { Check, Minus } from "lucide-react"

import { Reveal } from "@/components/marketing/motion"

type Cell = boolean | string
type Row = { label: string; values: [Cell, Cell, Cell, Cell] }
type Group = { name: string; rows: Row[] }

const PLANS = ["Free", "Pro", "Plus", "Business"] as const

const GROUPS: Group[] = [
  {
    name: "Capture & creation",
    rows: [
      { label: "Guides", values: ["5", "Unlimited", "Unlimited", "Unlimited"] },
      { label: "Browser capture", values: [true, true, true, true] },
      { label: "AI-written steps", values: [true, true, true, true] },
      { label: "Interactive walkthroughs", values: [true, true, true, true] },
      { label: "Desktop capture", values: [false, false, true, true] },
    ],
  },
  {
    name: "Customization",
    rows: [
      { label: "Themes", values: ["Basic", "Advanced", "Advanced", "Advanced"] },
      { label: "Logo & brand colors", values: [false, true, true, true] },
      { label: "Remove Tacto branding", values: [false, true, true, true] },
      { label: "Help center on custom domain", values: [false, false, true, true] },
    ],
  },
  {
    name: "Tacto AI",
    rows: [
      { label: "AI credits / month", values: ["100", "5,000", "10,000", "100,000"] },
      { label: "Voice-over narration", values: [false, false, true, true] },
      { label: "Guide translations", values: [false, false, true, true] },
      { label: "Auto-redact PII", values: [false, false, false, true] },
    ],
  },
  {
    name: "Sharing & export",
    rows: [
      { label: "Share via link & embed", values: [true, true, true, true] },
      { label: "PDF export", values: [false, true, true, true] },
      { label: "MP4 export", values: [false, true, true, true] },
      { label: "Password protection", values: [false, false, true, true] },
    ],
  },
  {
    name: "Analytics",
    rows: [
      { label: "View counts", values: [true, true, true, true] },
      { label: "Completion & drop-off", values: [false, true, true, true] },
      { label: "Team dashboards", values: [false, false, false, true] },
    ],
  },
  {
    name: "Team & security",
    rows: [
      { label: "Seats included", values: ["1", "1", "1", "5"] },
      { label: "SAML SSO", values: [false, false, false, true] },
      { label: "Roles & permissions", values: [false, false, false, true] },
      { label: "Audit log", values: [false, false, false, true] },
    ],
  },
]

function CellView({ value }: { value: Cell }) {
  if (value === true) return <Check className="mx-auto size-4 text-cobalt" strokeWidth={2.5} />
  if (value === false) return <Minus className="mx-auto size-4 text-[var(--l-ink-tertiary)]/50" />
  return <span className="text-[13px] font-medium text-[var(--l-ink)]">{value}</span>
}

/** The full plan-by-plan feature matrix. Server-rendered; scrolls horizontally
 *  on narrow screens so the body never overflows. */
export function PricingComparison() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-28">
        <Reveal className="text-center">
          <p className="font-mono text-[11px] tracking-widest text-cobalt uppercase">Compare plans</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.02em] text-[var(--l-ink)] sm:text-4xl">
            Every feature, side by side.
          </h2>
        </Reveal>

        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="sticky top-16 z-10">
                <th className="w-[34%] bg-white pb-4" />
                {PLANS.map((p) => (
                  <th key={p} className="bg-white pb-4 text-center">
                    <span className="font-display text-[15px] font-semibold text-[var(--l-ink)]">{p}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((group) => (
                <Fragment key={group.name}>
                  <tr>
                    <td
                      colSpan={5}
                      className="border-t border-[var(--l-hairline)] pt-6 pb-2 font-mono text-[11px] tracking-widest text-cobalt uppercase"
                    >
                      {group.name}
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.label} className="border-t border-[var(--l-hairline)]/60">
                      <td className="py-3 pr-4 text-[13.5px] text-[var(--l-ink-subtle)]">{row.label}</td>
                      {row.values.map((v, i) => (
                        <td key={i} className="px-2 py-3 text-center">
                          <CellView value={v} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
