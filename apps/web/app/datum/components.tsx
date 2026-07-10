"use client"

import * as React from "react"
import { motion, useReducedMotion, type Variants } from "motion/react"
import { useRive } from "@rive-app/react-canvas"

/* ── Motion tokens — calm springs, precision over spectacle ─────────────── */
const spring = { type: "spring" as const, stiffness: 380, damping: 30 }
const softSpring = { type: "spring" as const, stiffness: 120, damping: 20 }

/** Scroll-reveal that respects reduced motion. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ ...softSpring, delay }}
    >
      {children}
    </motion.div>
  )
}

/* ── Buttons — spring press + hover lift ───────────────────────────────── */
export function MotionButton({
  variant = "primary",
  children,
  ...props
}: React.ComponentProps<typeof motion.button> & {
  variant?: "primary" | "ghost" | "text"
}) {
  return (
    <motion.button
      whileHover={{ y: variant === "text" ? 0 : -1 }}
      whileTap={{ scale: 0.97 }}
      transition={spring}
      className={`dt-btn dt-btn-${variant}`}
      {...props}
    >
      {children}
    </motion.button>
  )
}

/* ── Card — hover lift with shadow ─────────────────────────────────────── */
export function HoverCard({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: "var(--e2)" }}
      transition={spring}
      className={`dt-card ${className}`}
    >
      {children}
    </motion.div>
  )
}

/* ── Animated icons — motion + line SVG, animate on hover ──────────────── */
function IconShell({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) {
  return (
    <motion.button
      initial="rest"
      whileHover="hover"
      whileFocus="hover"
      animate="rest"
      whileTap={{ scale: 0.9 }}
      transition={spring}
      aria-label={label}
      style={{
        display: "grid",
        placeItems: "center",
        width: 44,
        height: 44,
        borderRadius: 10,
        border: "1px solid var(--line-2)",
        background: "var(--plate)",
        color: "var(--ink)",
        cursor: "pointer",
      }}
    >
      {children}
    </motion.button>
  )
}

export function CaptureIcon() {
  const tick: Variants = { rest: { scaleY: 1, opacity: 0.9 }, hover: { scaleY: 1.5, opacity: 1 } }
  return (
    <IconShell label="Capture">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="var(--cobalt)" strokeWidth="1.6">
        <motion.circle cx="11" cy="11" r="4.4" variants={{ rest: { scale: 1 }, hover: { scale: 0.82 } }} style={{ transformOrigin: "11px 11px" }} transition={spring} />
        <circle cx="11" cy="11" r="1.4" fill="var(--cobalt)" stroke="none" />
        <motion.line x1="11" y1="1.5" x2="11" y2="4.5" variants={tick} style={{ transformOrigin: "11px 3px" }} transition={spring} />
        <motion.line x1="11" y1="17.5" x2="11" y2="20.5" variants={tick} style={{ transformOrigin: "11px 19px" }} transition={spring} />
        <motion.line x1="1.5" y1="11" x2="4.5" y2="11" variants={{ rest: { scaleX: 1 }, hover: { scaleX: 1.5 } }} style={{ transformOrigin: "3px 11px" }} transition={spring} />
        <motion.line x1="17.5" y1="11" x2="20.5" y2="11" variants={{ rest: { scaleX: 1 }, hover: { scaleX: 1.5 } }} style={{ transformOrigin: "19px 11px" }} transition={spring} />
      </svg>
    </IconShell>
  )
}

export function CursorIcon() {
  return (
    <IconShell label="Click point">
      <motion.svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round"
        variants={{ rest: { rotate: 0, scale: 1 }, hover: { rotate: -8, scale: 0.92 } }} transition={spring}>
        <path d="M4 3l6.5 15 2-6 6-2z" fill="var(--cobalt)" stroke="var(--cobalt)" />
      </motion.svg>
    </IconShell>
  )
}

export function SparkIcon() {
  return (
    <IconShell label="AI">
      <motion.svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round"
        variants={{ rest: { rotate: 0, scale: 1 }, hover: { rotate: 90, scale: 1.08 } }} transition={{ type: "spring", stiffness: 200, damping: 16 }}>
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />
      </motion.svg>
    </IconShell>
  )
}

export function ArrowIcon() {
  return (
    <IconShell label="Continue">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <motion.g variants={{ rest: { x: 0 }, hover: { x: 3 } }} transition={spring}>
          <line x1="3" y1="11" x2="18" y2="11" />
          <path d="M12 5l6 6-6 6" />
        </motion.g>
      </svg>
    </IconShell>
  )
}

/* ── Rive wrapper — plays a .riv when present, else the SVG fallback ────── */
export function RiveArt({
  src,
  stateMachine,
  fallback,
  width = 220,
  height = 150,
}: {
  src?: string
  stateMachine?: string
  fallback: React.ReactNode
  width?: number
  height?: number
}) {
  if (!src) return <>{fallback}</>
  return <RiveCanvas src={src} stateMachine={stateMachine} width={width} height={height} fallback={fallback} />
}

function RiveCanvas({
  src,
  stateMachine,
  width,
  height,
  fallback,
}: {
  src: string
  stateMachine?: string
  width: number
  height: number
  fallback: React.ReactNode
}) {
  const { RiveComponent, rive } = useRive({
    src,
    autoplay: true,
    ...(stateMachine ? { stateMachines: stateMachine } : {}),
  })
  // If the asset never loads, fall back to the SVG.
  if (rive === null) return <>{fallback}</>
  return <RiveComponent style={{ width, height }} />
}

/* ── The proprietary line illustration (Framer-Motion draw-in) ─────────── */
export function ThroughlineIllustration() {
  const reduce = useReducedMotion()
  const draw = {
    hidden: { pathLength: 0, opacity: 0 },
    show: (i: number) => ({
      pathLength: 1,
      opacity: 1,
      transition: { pathLength: { duration: 0.9, delay: 0.15 * i, ease: [0.22, 1, 0.36, 1] as const }, opacity: { duration: 0.01, delay: 0.15 * i } },
    }),
  }
  const node = {
    hidden: { scale: 0, opacity: 0 },
    show: (i: number) => ({ scale: 1, opacity: 1, transition: { ...spring, delay: 0.4 + 0.18 * i } }),
  }
  return (
    <motion.svg
      width="230" height="150" viewBox="0 0 230 150" fill="none"
      initial={reduce ? "show" : "hidden"} whileInView="show" viewport={{ once: true }}
      aria-hidden="true"
    >
      <motion.rect x="28" y="16" width="174" height="118" rx="10" stroke="var(--line-2)" strokeWidth="1.5" variants={draw} custom={0} />
      <motion.path d="M28 40h174" stroke="var(--line-2)" strokeWidth="1.5" variants={draw} custom={1} />
      <circle cx="42" cy="28" r="2.5" fill="var(--line-2)" />
      <circle cx="52" cy="28" r="2.5" fill="var(--line-2)" />
      <circle cx="62" cy="28" r="2.5" fill="var(--line-2)" />
      <motion.path d="M66 96 L114 66 L160 104" stroke="var(--cobalt)" strokeWidth="1.5" strokeDasharray="4 5" strokeLinecap="round" variants={draw} custom={2} />
      <motion.g variants={node} custom={0}>
        <circle cx="66" cy="96" r="8" fill="var(--plate)" stroke="var(--cobalt)" strokeWidth="1.5" />
        <text x="66" y="99.5" fontSize="9" fill="var(--cobalt)" textAnchor="middle" fontFamily="var(--dt-mono)">1</text>
      </motion.g>
      <motion.g variants={node} custom={1}>
        <circle cx="114" cy="66" r="8" fill="var(--plate)" stroke="var(--cobalt)" strokeWidth="1.5" />
        <text x="114" y="69.5" fontSize="9" fill="var(--cobalt)" textAnchor="middle" fontFamily="var(--dt-mono)">2</text>
      </motion.g>
      <motion.g variants={node} custom={2}>
        <circle cx="160" cy="104" r="8" fill="var(--plate)" stroke="var(--line-2)" strokeWidth="1.5" />
        <text x="160" y="107.5" fontSize="9" fill="var(--ink-3)" textAnchor="middle" fontFamily="var(--dt-mono)">3</text>
      </motion.g>
    </motion.svg>
  )
}

/* ── States ────────────────────────────────────────────────────────────── */
export function EmptyState() {
  return (
    <div className="dt-empty">
      <span className="dt-reg tl" /><span className="dt-reg tr" />
      <span className="dt-reg bl" /><span className="dt-reg br" />
      <div style={{ display: "grid", placeItems: "center" }}>
        <RiveArt fallback={<ThroughlineIllustration />} />
      </div>
      <h3>No guides yet</h3>
      <p>Record a workflow once. Tacto threads your clicks into a guide — you just clean it up.</p>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <MotionButton variant="primary"><CaptureInline />Start a capture</MotionButton>
      </div>
    </div>
  )
}

function CaptureInline() {
  return (
    <svg width="15" height="15" viewBox="0 0 22 22" fill="none" stroke="#fff" strokeWidth="1.7">
      <circle cx="11" cy="11" r="4.2" /><circle cx="11" cy="11" r="1.3" fill="#fff" stroke="none" />
    </svg>
  )
}

export function LoadingState() {
  const reduce = useReducedMotion()
  return (
    <div className="dt-plate" style={{ boxShadow: "var(--e1)" }}>
      <div className="bar"><span /><span /><span /><span className="addr" /></div>
      <div className="canvas" style={{ minHeight: 210 }}>
        <div style={{ display: "flex", gap: 14 }}>
          {/* throughline that draws itself, node by node */}
          <div style={{ position: "relative", width: 24, flex: "none" }}>
            <motion.div
              style={{ position: "absolute", left: 11, top: 6, width: 1.5, background: "var(--cobalt)", transformOrigin: "top" }}
              initial={{ height: reduce ? 84 : 0 }}
              animate={{ height: 84 }}
              transition={{ duration: reduce ? 0 : 1.4, ease: [0.22, 1, 0.36, 1], repeat: reduce ? 0 : Infinity, repeatType: "loop", repeatDelay: 0.4 }}
            />
            {[0, 1, 2].map((i) => (
              <motion.span key={i}
                style={{ position: "absolute", left: 6, top: 6 + i * 38, width: 12, height: 12, borderRadius: "50%", background: "var(--plate)", border: "1.5px solid var(--cobalt)", boxSizing: "border-box" }}
                initial={{ scale: reduce ? 1 : 0 }} animate={{ scale: 1 }}
                transition={{ ...spring, delay: reduce ? 0 : 0.4 + i * 0.45, repeat: reduce ? 0 : Infinity, repeatDelay: 1.4 - i * 0.45 + i * 0.45, repeatType: "loop" }}
              />
            ))}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="dt-skel" style={{ height: 12, width: "70%" }} />
            <div className="dt-skel" style={{ height: 12, width: "52%" }} />
            <div className="dt-skel" style={{ height: 12, width: "84%" }} />
            <div className="dt-skel" style={{ height: 12, width: "44%" }} />
          </div>
        </div>
        <div className="dt-mono" style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, fontSize: 12, color: "var(--ink-2)" }}>
          <motion.span
            animate={reduce ? {} : { opacity: [1, 0.35, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--cobalt)" }}
          />
          Building your guide — 3 of 5 steps threaded
        </div>
      </div>
    </div>
  )
}

export function ErrorState({ onRetry, onDismiss }: { onRetry?: () => void; onDismiss?: () => void }) {
  return (
    <div className="dt-card" style={{ borderColor: "var(--line-2)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <span style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 10, background: "var(--rose-tint)", color: "var(--rose)", flex: "none" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <path d="M12 8v5M12 16.5v.5" /><path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
          </svg>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 15, fontWeight: 560 }}>Couldn’t process this capture</strong>
            <span className="dt-badge err"><span className="dot" />Failed</span>
          </div>
          <p style={{ color: "var(--ink-2)", fontSize: 14, margin: "6px 0 16px", lineHeight: 1.5 }}>
            No screenshots were captured, so there’s nothing to build. Record it again, or dismiss this capture.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <MotionButton variant="ghost" onClick={onRetry}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 4v6h6M20 20v-6h-6" /><path d="M20 10a8 8 0 0 0-14-3M4 14a8 8 0 0 0 14 3" /></svg>
              Retry
            </MotionButton>
            <MotionButton variant="text" onClick={onDismiss}>Dismiss</MotionButton>
          </div>
        </div>
      </div>
    </div>
  )
}
