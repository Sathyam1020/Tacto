"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"

import {
  ArrowIcon,
  CaptureIcon,
  CursorIcon,
  EmptyState,
  ErrorState,
  HoverCard,
  LoadingState,
  MotionButton,
  Reveal,
  SparkIcon,
} from "./components"

export default function DatumShowcase() {
  const [errorGone, setErrorGone] = React.useState(false)

  return (
    <main>
      {/* Top bar */}
      <div style={{ borderBottom: "1px solid var(--line)", position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(12px)", background: "color-mix(in srgb, var(--paper) 82%, transparent)" }}>
        <div className="dt-wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="var(--cobalt)" strokeWidth="1.5">
              <circle cx="11" cy="11" r="4.4" /><circle cx="11" cy="11" r="1.5" fill="var(--cobalt)" stroke="none" />
              <path d="M11 1.5v3M11 17.5v3M1.5 11h3M17.5 11h3" />
            </svg>
            <span style={{ fontWeight: 560, fontSize: 18, letterSpacing: "-0.02em" }}>Tacto</span>
            <span className="dt-eyebrow" style={{ paddingLeft: 13, borderLeft: "1px solid var(--line-2)" }}>Datum · Live components</span>
          </div>
          <span className="dt-eyebrow">Geist · Motion · Rive</span>
        </div>
      </div>

      {/* Hero */}
      <header className="dt-wrap" style={{ padding: "clamp(56px,10vh,110px) 40px 72px" }}>
        <Reveal>
          <span className="dt-eyebrow" style={{ color: "var(--cobalt)" }}>Version 2 — built for real</span>
          <h1 className="dt-h1" style={{ margin: "22px 0 0", maxWidth: "14ch" }}>
            Precision you can <b>feel.</b>
          </h1>
          <p className="dt-sub" style={{ marginTop: 24, maxWidth: "44ch" }}>
            The Datum language, running in React — Framer Motion for movement, Rive-ready illustration, animated icons, and considered empty, loading and error states.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
            <MotionButton variant="primary">Start a capture</MotionButton>
            <MotionButton variant="ghost">View components</MotionButton>
          </div>
        </Reveal>
      </header>

      {/* Motion + icons */}
      <section className="dt-sec">
        <div className="dt-wrap">
          <div className="dt-sechead">
            <span className="n">01</span>
            <h2 className="dt-h2">Motion &amp; icons — hover me</h2>
          </div>
          <Reveal>
            <div className="dt-grid2">
              <div className="dt-card">
                <span className="dt-eyebrow" style={{ display: "block", marginBottom: 18 }}>Animated icons</span>
                <div style={{ display: "flex", gap: 14 }}>
                  <CaptureIcon /><CursorIcon /><SparkIcon /><ArrowIcon />
                </div>
                <p className="dt-sub" style={{ fontSize: 14, marginTop: 18 }}>
                  Line icons that respond on hover and focus — the reticle contracts, the spark turns, the arrow advances. Spring physics, never bounce.
                </p>
              </div>
              <HoverCard>
                <span className="dt-eyebrow" style={{ display: "block", marginBottom: 18 }}>Hover state — a plate lifts</span>
                <div className="dt-plate" style={{ maxWidth: 360 }}>
                  <div className="bar"><span /><span /><span /><span className="addr" /></div>
                  <div className="canvas" style={{ minHeight: 150 }}>
                    <div className="l" style={{ width: "60%" }} />
                    <div className="l" style={{ width: "82%" }} />
                    <div className="ctrl">Invite teammate</div>
                    <div className="dt-reticle" style={{ left: 112, top: 128 }}>
                      <span className="c" /><span className="d" /><i className="t" /><i className="b" /><i className="l" /><i className="r" />
                    </div>
                  </div>
                </div>
              </HoverCard>
            </div>
          </Reveal>
        </div>
      </section>

      {/* States */}
      <section className="dt-sec">
        <div className="dt-wrap">
          <div className="dt-sechead">
            <span className="n">02</span>
            <h2 className="dt-h2">Empty, loading &amp; error — every state designed</h2>
          </div>
          <div className="dt-grid3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            <Reveal delay={0}>
              <span className="dt-eyebrow" style={{ display: "block", marginBottom: 12 }}>Empty · illustrated</span>
              <EmptyState />
            </Reveal>
            <Reveal delay={0.08}>
              <span className="dt-eyebrow" style={{ display: "block", marginBottom: 12 }}>Loading · no spinner</span>
              <LoadingState />
            </Reveal>
            <Reveal delay={0.16}>
              <span className="dt-eyebrow" style={{ display: "block", marginBottom: 12 }}>Error · recoverable</span>
              <AnimatePresence mode="wait">
                {errorGone ? (
                  <motion.div
                    key="dismissed"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="dt-card"
                    style={{ display: "grid", placeItems: "center", minHeight: 150, color: "var(--ink-3)" }}
                  >
                    <div style={{ textAlign: "center" }}>
                      <div className="dt-mono" style={{ fontSize: 12 }}>Capture dismissed</div>
                      <button
                        className="dt-btn dt-btn-text"
                        style={{ marginTop: 8 }}
                        onClick={() => setErrorGone(false)}
                      >
                        Undo
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="error" exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                    <ErrorState onRetry={() => {}} onDismiss={() => setErrorGone(true)} />
                  </motion.div>
                )}
              </AnimatePresence>
            </Reveal>
          </div>
        </div>
      </section>

      <footer className="dt-sec" style={{ paddingBottom: 96 }}>
        <div className="dt-wrap">
          <span className="dt-eyebrow" style={{ color: "var(--cobalt)" }}>Foundation ready</span>
          <p className="dt-h2" style={{ marginTop: 16, maxWidth: "20ch" }}>
            Tokens, motion and states — the base every screen is built on.
          </p>
          <p className="dt-mono" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 32, letterSpacing: "0.06em" }}>
            TACTO · DATUM · GEIST + MOTION + RIVE · SCOPED, NON-DESTRUCTIVE
          </p>
        </div>
      </footer>
    </main>
  )
}
