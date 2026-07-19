"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  BarChart3,
  BookOpen,
  BookText,
  ChevronDown,
  Puzzle,
  ClipboardList,
  FileText,
  GraduationCap,
  Headset,
  History,
  LayoutGrid,
  LifeBuoy,
  Megaphone,
  Menu,
  MousePointerClick,
  Newspaper,
  Library,
  Rocket,
  ScrollText,
  Workflow,
  Wrench,
  X,
} from "lucide-react"

import { buttonVariants } from "@workspace/ui/components/button"
import { LogoMark } from "@workspace/ui/components/logo"
import { cn } from "@workspace/ui/lib/utils"

import { authClient } from "@/lib/auth-client"

const EASE = [0.22, 1, 0.36, 1] as const

type MenuItem = { icon: React.ComponentType<{ className?: string }>; label: string; desc: string; href: string }

const SOLUTIONS: MenuItem[] = [
  { icon: FileText, label: "Step-by-step guides", desc: "AI writes a step for every click", href: "/features" },
  { icon: MousePointerClick, label: "Interactive walkthroughs", desc: "Click-through demos that feel live", href: "/#demo" },
  { icon: LayoutGrid, label: "Showcases", desc: "Branded, embeddable collections", href: "/showcase" },
  { icon: LifeBuoy, label: "Help center", desc: "A searchable knowledge base", href: "/help" },
  { icon: ClipboardList, label: "Forms", desc: "Collect answers inside a guide", href: "/features" },
  { icon: BarChart3, label: "Analytics", desc: "Views, completion, and drop-off", href: "/features" },
]
const USE_CASES: MenuItem[] = [
  { icon: GraduationCap, label: "Employee onboarding", desc: "Ramp new hires on day one", href: "/use-cases/onboarding" },
  { icon: Headset, label: "Customer support", desc: "Deflect “how do I…?” tickets", href: "/use-cases/support" },
  { icon: ScrollText, label: "SOPs & documentation", desc: "Keep processes current", href: "/use-cases/sops" },
  { icon: Workflow, label: "Process documentation", desc: "Capture how work gets done", href: "/use-cases/process-documentation" },
  { icon: Library, label: "Knowledge base", desc: "A branded, searchable help center", href: "/use-cases/knowledge-base" },
  { icon: Rocket, label: "User onboarding", desc: "Guide users to first value", href: "/use-cases/user-onboarding" },
  { icon: Megaphone, label: "Product marketing", desc: "Interactive demos that convert", href: "/use-cases/product-marketing" },
  { icon: Wrench, label: "IT & helpdesk", desc: "A guide for every internal tool", href: "/use-cases/it" },
  { icon: BookOpen, label: "Training", desc: "Courses people actually finish", href: "/use-cases/training" },
]
const RESOURCES: MenuItem[] = [
  { icon: Newspaper, label: "Blog", desc: "Guides, playbooks, and ideas", href: "/blog" },
  { icon: Puzzle, label: "Chrome extension", desc: "Record from your browser", href: "/chrome" },
  { icon: History, label: "Changelog", desc: "What shipped recently", href: "/changelog" },
  { icon: BookText, label: "Docs", desc: "Everything, documented", href: "/docs" },
]

type MenuKey = "solutions" | "use-cases" | "resources"
const MENUS: { key: MenuKey; label: string; items: MenuItem[] }[] = [
  { key: "solutions", label: "Solutions", items: SOLUTIONS },
  { key: "use-cases", label: "Use cases", items: USE_CASES },
  { key: "resources", label: "Resources", items: RESOURCES },
]

export function MarketingNav() {
  const reduce = useReducedMotion()
  const { data: session } = authClient.useSession()
  const loggedIn = !!session?.user
  const [active, setActive] = React.useState<MenuKey | null>(null)
  const [mobile, setMobile] = React.useState(false)
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const open = React.useCallback((k: MenuKey) => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setActive(k)
  }, [])
  const scheduleClose = React.useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setActive(null), 140)
  }, [])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActive(null)
        setMobile(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  React.useEffect(() => {
    if (!mobile) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobile])

  const activeItems = MENUS.find((m) => m.key === active)?.items

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--l-hairline)]/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Tacto home">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-cobalt">
            <LogoMark className="size-5" />
          </span>
          <span className="font-display text-[19px] font-semibold tracking-tight text-[var(--l-ink)]">Tacto</span>
        </Link>

        {/* desktop nav */}
        <nav className="hidden items-center gap-1 md:flex" onMouseLeave={scheduleClose} aria-label="Primary">
          {MENUS.map((m) => (
            <button
              key={m.key}
              type="button"
              onMouseEnter={() => open(m.key)}
              onFocus={() => open(m.key)}
              onClick={() => setActive((a) => (a === m.key ? null : m.key))}
              aria-expanded={active === m.key}
              className={cn(
                "flex items-center gap-1 rounded-lg px-3 py-2 text-[14px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-cobalt/50 focus-visible:outline-none",
                active === m.key ? "text-[var(--l-ink)]" : "text-[var(--l-ink-subtle)] hover:text-[var(--l-ink)]"
              )}
            >
              {m.label}
              <ChevronDown className={cn("size-3.5 transition-transform duration-200", active === m.key && "rotate-180")} />
            </button>
          ))}
          <Link href="/pricing" className="rounded-lg px-3 py-2 text-[14px] font-medium text-[var(--l-ink-subtle)] transition-colors hover:text-[var(--l-ink)] focus-visible:ring-2 focus-visible:ring-cobalt/50 focus-visible:outline-none">
            Pricing
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {loggedIn ? (
            <Link href="/home" className={cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}>
              My account
            </Link>
          ) : (
            <>
              <Link href="/sign-in" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}>
                Log in
              </Link>
              <Link href="/sign-up" className={cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}>
                Start for free
              </Link>
            </>
          )}
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-lg text-[var(--l-ink)] transition-colors hover:bg-[var(--l-hover)] focus-visible:ring-2 focus-visible:ring-cobalt/50 focus-visible:outline-none md:hidden"
            aria-label="Open menu"
            onClick={() => setMobile(true)}
          >
            <Menu className="size-5" />
          </button>
        </div>
      </div>

      {/* desktop mega panel — all three menus share the icon + description grid */}
      <AnimatePresence>
        {active && activeItems && (
          <motion.div
            key="panel"
            onMouseEnter={() => open(active)}
            onMouseLeave={scheduleClose}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="absolute inset-x-0 top-16 hidden justify-center px-5 md:flex"
          >
            <div className="w-full max-w-xl rounded-2xl border border-[var(--l-hairline)] bg-white p-3 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.25)]">
              <div className="grid grid-cols-2 gap-1">
                {activeItems.map((p) => (
                  <Link key={p.label} href={p.href} className="group flex gap-3 rounded-xl p-3 transition-colors hover:bg-[var(--l-hover)]">
                    <span className="flex size-9 flex-none items-center justify-center rounded-lg bg-primary/10 text-cobalt transition-transform duration-200 group-hover:scale-105">
                      <p.icon className="size-[18px]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-medium text-[var(--l-ink)]">{p.label}</span>
                      <span className="block truncate text-[12.5px] text-[var(--l-ink-subtle)]">{p.desc}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* mobile drawer */}
      <AnimatePresence>{mobile && <MobileDrawer reduce={!!reduce} loggedIn={loggedIn} onClose={() => setMobile(false)} />}</AnimatePresence>
    </header>
  )
}

/* ── mobile drawer: full-height sheet with collapsible sections ──────────── */
/* Portalled to <body> so it escapes the nav header's backdrop-filter, which
 * would otherwise become the containing block for this `fixed` panel and
 * collapse it to the header's height. */
function MobileDrawer({ reduce, loggedIn, onClose }: { reduce: boolean; loggedIn: boolean; onClose: () => void }) {
  const [openSection, setOpenSection] = React.useState<MenuKey | null>("solutions")
  if (typeof document === "undefined") return null

  return createPortal(
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-black/30 md:hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        className="fixed inset-y-0 right-0 z-50 flex w-[88%] max-w-sm flex-col bg-white md:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        initial={reduce ? { opacity: 0 } : { x: "100%" }}
        animate={reduce ? { opacity: 1 } : { x: 0 }}
        exit={reduce ? { opacity: 0 } : { x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
      >
        <div className="flex h-16 flex-none items-center justify-between border-b border-[var(--l-hairline)] px-5">
          <span className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-cobalt">
              <LogoMark className="size-5" />
            </span>
            <span className="font-display text-[17px] font-semibold tracking-tight">Tacto</span>
          </span>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-lg text-[var(--l-ink)] transition-colors hover:bg-[var(--l-hover)] focus-visible:ring-2 focus-visible:ring-cobalt/50 focus-visible:outline-none"
          >
            <X className="size-5" />
          </button>
        </div>

        <motion.nav
          className="flex-1 overflow-y-auto px-4 py-4"
          initial="hidden"
          animate="show"
          variants={reduce ? undefined : { show: { transition: { staggerChildren: 0.05, delayChildren: 0.06 } } }}
        >
          {MENUS.map((m) => {
            const isOpen = openSection === m.key
            return (
              <motion.div
                key={m.key}
                className="border-b border-[var(--l-hairline)]"
                variants={reduce ? undefined : { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
              >
                <button
                  type="button"
                  onClick={() => setOpenSection(isOpen ? null : m.key)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between py-3.5 text-left text-[15px] font-semibold text-[var(--l-ink)]"
                >
                  {m.label}
                  <ChevronDown className={cn("size-4 text-[var(--l-ink-subtle)] transition-transform duration-300", isOpen && "rotate-180")} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={reduce ? undefined : { height: 0, opacity: 0 }}
                      animate={reduce ? undefined : { height: "auto", opacity: 1 }}
                      exit={reduce ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col gap-0.5 pb-3">
                        {m.items.map((it) => (
                          <Link
                            key={it.label}
                            href={it.href}
                            onClick={onClose}
                            className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-[14px] font-medium text-[var(--l-ink-subtle)] transition-colors hover:bg-[var(--l-hover)] hover:text-[var(--l-ink)]"
                          >
                            <span className="flex size-8 flex-none items-center justify-center rounded-lg bg-primary/10 text-cobalt">
                              <it.icon className="size-4" />
                            </span>
                            {it.label}
                          </Link>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
          <motion.div variants={reduce ? undefined : { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
            <Link href="/pricing" onClick={onClose} className="block border-b border-[var(--l-hairline)] py-3.5 text-[15px] font-semibold text-[var(--l-ink)]">
              Pricing
            </Link>
          </motion.div>
        </motion.nav>

        <div className="flex flex-none flex-col gap-2 border-t border-[var(--l-hairline)] p-5">
          {loggedIn ? (
            <Link href="/home" onClick={onClose} className={cn(buttonVariants(), "w-full")}>
              My account
            </Link>
          ) : (
            <>
              <Link href="/sign-in" onClick={onClose} className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
                Log in
              </Link>
              <Link href="/sign-up" onClick={onClose} className={cn(buttonVariants(), "w-full")}>
                Start for free
              </Link>
            </>
          )}
        </div>
      </motion.div>
    </>,
    document.body
  )
}
