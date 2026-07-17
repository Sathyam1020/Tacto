"use client"

import * as React from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"
import { ArrowRight, Check } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

type Plan = {
  name: string
  tagline: string
  /** Monthly price in USD. null = custom (Enterprise). */
  monthly: number | null
  credits: string
  seats: string
  cta: { label: string; href: string }
  featured?: boolean
  badge?: string
  features: string[]
}

const PLANS: Plan[] = [
  {
    name: "Free",
    tagline: "For trying it on a real workflow.",
    monthly: 0,
    credits: "100 AI credits / mo",
    seats: "1 seat",
    cta: { label: "Start for free", href: "/sign-up" },
    features: [
      "5 guides",
      "Unlimited guide views",
      "Browser capture",
      "AI-written steps",
      "Interactive walkthroughs",
      "Share via link & embed",
    ],
  },
  {
    name: "Pro",
    tagline: "For creators who publish regularly.",
    monthly: 19,
    credits: "5,000 AI credits / mo",
    seats: "1 seat · $19/mo per extra",
    cta: { label: "Start free trial", href: "/sign-up" },
    features: [
      "Unlimited guides",
      "Remove Tacto branding",
      "Custom themes & branding",
      "Showcases",
      "Forms",
      "Views, completion & drop-off analytics",
      "PDF & MP4 export",
    ],
  },
  {
    name: "Plus",
    tagline: "For teams that live in their docs.",
    monthly: 25,
    credits: "10,000 AI credits / mo",
    seats: "1 seat · $25/mo per extra",
    featured: true,
    badge: "Best value",
    cta: { label: "Start free trial", href: "/sign-up" },
    features: [
      "Help center on a custom domain",
      "Voice-over narration",
      "Desktop capture",
      "Guide translations",
      "Password-protected guides",
      "Priority support",
    ],
  },
  {
    name: "Business",
    tagline: "For orgs standardizing on Tacto.",
    monthly: 75,
    credits: "100,000 AI credits / mo",
    seats: "5 seats · $15/mo per extra",
    cta: { label: "Start free trial", href: "/sign-up" },
    features: [
      "Auto-redact PII",
      "SAML SSO",
      "Multiple workspaces",
      "Advanced roles & permissions",
      "Audit log",
      "Dedicated success manager",
    ],
  },
]

/** Yearly effective monthly = 10 months' cost spread over 12 (2 months free). */
function yearlyMonthly(monthly: number): number {
  return Math.round((monthly * 10) / 12)
}

export function PricingPlans() {
  const [yearly, setYearly] = React.useState(true)
  const reduce = useReducedMotion()

  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8">
      {/* Billing toggle */}
      <div className="flex flex-col items-center gap-3">
        <div className="inline-flex items-center rounded-full border border-[var(--l-hairline)] bg-white p-1 shadow-sm">
          {(["monthly", "yearly"] as const).map((k) => {
            const active = (k === "yearly") === yearly
            return (
              <button
                key={k}
                type="button"
                role="switch"
                aria-checked={active}
                onClick={() => setYearly(k === "yearly")}
                className={cn(
                  "relative z-10 rounded-full px-4 py-1.5 text-[13.5px] font-medium capitalize transition-colors focus-visible:ring-2 focus-visible:ring-cobalt/50 focus-visible:outline-none",
                  active ? "text-white" : "text-[var(--l-ink-subtle)] hover:text-[var(--l-ink)]"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="billing-pill"
                    className="absolute inset-0 -z-10 rounded-full bg-primary"
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                {k}
              </button>
            )
          })}
        </div>
        <p className="font-mono text-[11px] tracking-wide text-[var(--l-ink-tertiary)] uppercase">
          Yearly billing saves you two months
        </p>
      </div>

      {/* Plan cards */}
      <div className="mt-12 grid gap-5 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const price = plan.monthly === null ? null : yearly ? yearlyMonthly(plan.monthly) : plan.monthly
          return (
            <div
              key={plan.name}
              className={cn(
                "relative flex flex-col rounded-3xl border bg-white p-6 transition-all duration-300",
                plan.featured
                  ? "border-primary/40 shadow-[0_28px_70px_-32px_rgba(94,105,210,0.55)] ring-1 ring-primary/20"
                  : "border-[var(--l-hairline)] shadow-sm hover:-translate-y-0.5 hover:shadow-lg"
              )}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-6 inline-flex items-center rounded-full bg-primary px-3 py-1 text-[11px] font-semibold tracking-wide text-white uppercase shadow-sm">
                  {plan.badge}
                </span>
              )}
              <h3 className="font-display text-lg font-semibold tracking-tight text-[var(--l-ink)]">{plan.name}</h3>
              <p className="mt-1 min-h-[40px] text-[13px] leading-snug text-[var(--l-ink-subtle)]">{plan.tagline}</p>

              <div className="mt-4 flex items-end gap-1">
                {price === null ? (
                  <span className="font-display text-3xl font-semibold text-[var(--l-ink)]">Custom</span>
                ) : (
                  <>
                    <span className="font-display text-[40px] leading-none font-semibold text-[var(--l-ink)]">${price}</span>
                    <span className="mb-1 text-[13px] text-[var(--l-ink-tertiary)]">/mo</span>
                  </>
                )}
              </div>
              <p className="mt-1 h-4 text-[12px] text-[var(--l-ink-tertiary)]">
                {price && price > 0 ? (yearly ? "billed annually" : "billed monthly") : price === 0 ? "free forever" : " "}
              </p>

              <Link
                href={plan.cta.href}
                className={cn(
                  "mt-5 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-[13.5px] font-semibold transition-all focus-visible:ring-2 focus-visible:ring-cobalt/50 focus-visible:outline-none",
                  plan.featured
                    ? "bg-primary text-white hover:brightness-110"
                    : "border border-[var(--l-hairline-strong)] bg-white text-[var(--l-ink)] hover:bg-[var(--l-hover)]"
                )}
              >
                {plan.cta.label}
                <ArrowRight className="size-3.5" />
              </Link>

              <div className="mt-5 space-y-1 border-t border-[var(--l-hairline)] pt-5">
                <p className="text-[12.5px] font-medium text-[var(--l-ink)]">{plan.credits}</p>
                <p className="text-[12.5px] text-[var(--l-ink-tertiary)]">{plan.seats}</p>
              </div>

              <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                {plan.name !== "Free" && (
                  <li className="text-[12.5px] font-medium text-[var(--l-ink-subtle)]">
                    Everything in {plan.name === "Pro" ? "Free" : plan.name === "Plus" ? "Pro" : "Plus"}, plus:
                  </li>
                )}
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] text-[var(--l-ink-subtle)]">
                    <Check className="mt-0.5 size-4 flex-none text-cobalt" strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      {/* Enterprise strip */}
      <div className="mt-5 flex flex-col items-start justify-between gap-5 rounded-3xl border border-[var(--l-hairline)] bg-[var(--l-canvas)] p-7 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-display text-lg font-semibold tracking-tight text-[var(--l-ink)]">Enterprise</h3>
          <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-[var(--l-ink-subtle)]">
            For 20+ seats. SAML SSO across the org, a security &amp; DPA review, volume pricing, custom AI-credit
            allotments, and a named point of contact with an SLA.
          </p>
        </div>
        <Link
          href="/contact"
          className="inline-flex h-10 flex-none items-center justify-center gap-1.5 rounded-xl border border-[var(--l-hairline-strong)] bg-white px-5 text-[13.5px] font-semibold text-[var(--l-ink)] transition-colors hover:bg-[var(--l-hover)]"
        >
          Contact sales <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  )
}
