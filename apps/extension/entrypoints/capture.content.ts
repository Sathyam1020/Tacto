import type {
  ClickEvent,
  InputEvent,
  NavigationEvent,
  Settle,
} from "@workspace/contracts/capture"

import { safeSendMessage } from "@/lib/runtime"
import {
  describeClick,
  describeElement,
  maskValue,
  type ElementInfo,
} from "@/lib/selector"
import type { RecordedEvent } from "@/lib/types"

const PILL_ID = "__tacto_recording_pill__"

// DOM-settle tuning. Kept conservative; a future milestone delivers these from
// the server (CaptureConfig) so they're tunable without an extension release.
const SETTLE_QUIET_MS = 200 // no mutations for this long ⇒ stable
const SETTLE_MIN_MS = 80 // always let the first paint happen
const SETTLE_MAX_MS = 1200 // cap: pages that never quiet (spinners/ambient anim)
const OVERLAY_SELECTOR =
  "[role=dialog],[aria-modal=true],[role=menu],[role=listbox],[role=tooltip]"

/**
 * Capture engine — instruments the page while recording. Every meaningful
 * interaction becomes a normalized CaptureEvent sent to the background,
 * which pairs it with a screenshot. Shows a floating recording pill.
 */
export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    // Guard against double-init when the background injects this script into
    // a tab that already has the declarative content script (shared world).
    const g = globalThis as typeof globalThis & { __tactoCaptureLoaded?: true }
    if (g.__tactoCaptureLoaded) return
    g.__tactoCaptureLoaded = true

    let recording = false
    let lastUrl = location.href

    // Monotonic per-event id. Correlates an event with its before/after frames
    // in the background (replaces the old fragile "shots pushed in order").
    let seqCounter = 0
    const nextSeq = () => ++seqCounter
    // A pointerdown reserves a seq for the click that follows, so the pre-click
    // frame pairs with that exact click.
    let pendingSeq: number | null = null
    // The click target resolved at pointerdown (from the pointer coordinates in
    // the pre-action DOM), reused on the click that follows.
    let pendingClick:
      | { info: ElementInfo; confidence: number; drop: boolean }
      | null = null

    function viewport() {
      return { w: window.innerWidth, h: window.innerHeight }
    }

    /** Record an event + start watching for its settled "after" frame. */
    function record(
      event: RecordedEvent,
      seq: number,
      shot: "pending" | "now" | "none"
    ) {
      void safeSendMessage({ type: "RECORD_EVENT", event, seq, shot })
      startSettle(seq)
    }

    function recordNavigation() {
      const event: NavigationEvent = {
        type: "navigation",
        timestamp: Date.now(),
        url: location.href,
        pageTitle: document.title,
      }
      record(event, nextSeq(), "now")
    }

    /**
     * DOM-settle watcher (M2/M3). Observes the page until it stabilises, records
     * factual observations (mutated / overlay / url-changed), and asks the
     * background for the "after" frame — but only when the interaction actually
     * changed something AND didn't just navigate away (a navigation's own event
     * captures the destination; a click that navigates keeps its before frame).
     * Records nothing but facts — the frame CHOICE happens later, in the worker.
     */
    function startSettle(seq: number) {
      const startUrl = location.href
      const startedAt = Date.now()
      let mutated = false
      let overlayAppeared = false
      let done = false
      let quietTimer: ReturnType<typeof setTimeout> | null = null
      let capTimer: ReturnType<typeof setTimeout> | null = null

      const obs = new MutationObserver((batches) => {
        for (const m of batches) {
          const t = m.target as Node
          if (t instanceof Element && t.closest(`#${PILL_ID}`)) continue // ignore our pill
          mutated = true
          m.addedNodes.forEach((n) => {
            if (
              n instanceof Element &&
              (n.matches?.(OVERLAY_SELECTOR) || n.querySelector?.(OVERLAY_SELECTOR))
            )
              overlayAppeared = true
          })
        }
        scheduleQuiet()
      })

      function scheduleQuiet() {
        if (quietTimer) clearTimeout(quietTimer)
        quietTimer = setTimeout(() => {
          if (Date.now() - startedAt >= SETTLE_MIN_MS) finish()
          else scheduleQuiet()
        }, SETTLE_QUIET_MS)
      }

      function finish() {
        if (done) return
        done = true
        obs.disconnect()
        if (quietTimer) clearTimeout(quietTimer)
        if (capTimer) clearTimeout(capTimer)
        const urlChanged = location.href !== startUrl
        const settle: Settle = { mutated, overlayAppeared, urlChanged }
        // Capture an "after" frame only when something changed AND we didn't
        // just navigate away without opening an overlay (that result is the
        // navigation step's job). Saves both a capture (rate limit) and storage.
        const capture = mutated && (overlayAppeared || !urlChanged)
        // 2×rAF so the settled state is laid out + painted before we capture.
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            void safeSendMessage({ type: "POST_ACTION", seq, settle, capture })
          )
        )
      }

      obs.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
      })
      scheduleQuiet()
      capTimer = setTimeout(finish, SETTLE_MAX_MS)
    }

    const INTERACTIVE_SELECTOR =
      "a, button, [role=button], input, select, textarea, [role=menuitem], [role=menuitemcheckbox], [role=menuitemradio], [role=tab], [role=option], [role=switch], [role=checkbox], [role=radio], [role=link], [aria-haspopup], summary, label, [onclick], [tabindex]"

    /** Nearest genuinely-interactive ancestor, or null for dead page chrome. */
    function interactiveTarget(el: Element): Element | null {
      return el.closest(INTERACTIVE_SELECTOR)
    }

    /**
     * Resolve + describe the element a click actually landed on, from a hit-test
     * element. Uses the existing interactive resolver (so href-less SPA links
     * still work), adds a capture-time confidence, and flags a click that
     * resolved to <body>/<html> or an unlabeled non-control as droppable — the
     * signature of a framework retargeting the click (portal menus → <body>).
     */
    function resolveClickInfo(hit: Element): {
      info: ElementInfo
      confidence: number
      drop: boolean
    } {
      const interactive = interactiveTarget(hit)
      const el = interactive ?? hit
      const structural = el.tagName === "BODY" || el.tagName === "HTML"
      const { info, confidence, isGeneric } = describeClick(el)
      // Drop retargeted/dead clicks: structural containers, or an unlabeled
      // non-control (matches the old "no interactive + no label" guard).
      const drop = structural || (!interactive && isGeneric)
      return { info, confidence, drop }
    }

    /**
     * Toggle our recording pill for a screenshot, synchronously. We use OPACITY,
     * not visibility: opacity:0 is excluded from the capture (fully transparent)
     * but — unlike visibility:hidden — is NOT click-through, so the Stop button
     * always catches the click even mid-capture (no two-click stop, no stray
     * step recorded on the element behind the pill).
     */
    function setPillHidden(hidden: boolean) {
      const pill = document.getElementById(PILL_ID)
      if (pill) pill.style.opacity = hidden ? "0" : "1"
    }

    function onPointerDown(e: PointerEvent) {
      if (!recording) return
      // Clicking our own pill must NOT trigger a screenshot — the capture
      // hides the pill mid-click, which would swallow the Stop button click.
      const target = e.target as Element | null
      if (target?.closest(`#${PILL_ID}`)) return
      // Resolve the REAL element under the cursor now, in the pre-action DOM,
      // from the pointer coordinates — the reliable source of truth even when a
      // framework retargets the click event to <body> (portal menus etc.).
      const hit = document.elementFromPoint(e.clientX, e.clientY) ?? target
      pendingClick = hit ? resolveClickInfo(hit) : null
      // Hide the pill NOW, synchronously, so the imminent pre-click capture
      // never includes it — and so the background can grab the frame WITHOUT a
      // hide round-trip that would otherwise let the click's effect paint first.
      setPillHidden(true)
      // Reserve the seq for the click that follows, and grab its pre-click
      // ("before") frame immediately (pill already hidden).
      pendingSeq = nextSeq()
      void safeSendMessage({ type: "PRE_ACTION", seq: pendingSeq })
    }

    function onClick(e: MouseEvent) {
      if (!recording) return
      const raw = e.target as Element | null
      if (!raw || raw.closest(`#${PILL_ID}`)) return
      // Prefer the target resolved at pointerdown (pointer-as-truth, pre-action);
      // otherwise resolve the click point now.
      const resolved =
        pendingClick ??
        resolveClickInfo(document.elementFromPoint(e.clientX, e.clientY) ?? raw)
      const hadPre = pendingSeq !== null
      const seq = pendingSeq ?? nextSeq()
      pendingSeq = null
      pendingClick = null
      // A retargeted / structural / unlabeled dead click is not a real step.
      if (resolved.drop) return
      const event: ClickEvent = {
        type: "click",
        timestamp: Date.now(),
        url: location.href,
        pageTitle: document.title,
        viewport: viewport(),
        target: resolved.info,
        confidence: resolved.confidence,
      }
      // Use the pre-click frame reserved on pointerdown; if there was none
      // (synthetic click), fall back to capturing "now".
      record(event, seq, hadPre ? "pending" : "now")
    }

    function onFocusOut(e: FocusEvent) {
      if (!recording) return
      const el = e.target as HTMLElement | null
      if (
        !el ||
        !(
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          el instanceof HTMLSelectElement
        )
      )
        return
      // Buttons/checkboxes are handled by click, not text entry.
      if (el instanceof HTMLInputElement && ["checkbox", "radio", "button", "submit"].includes(el.type)) return

      const raw = "value" in el ? el.value : ""
      if (!raw.trim()) return
      const value =
        el instanceof HTMLInputElement ? maskValue(el, raw) : raw.slice(0, 120)
      const event: InputEvent = {
        type: "input",
        timestamp: Date.now(),
        url: location.href,
        pageTitle: document.title,
        viewport: viewport(),
        target: describeElement(el),
        value,
      }
      record(event, nextSeq(), "now")
    }

    // SPA navigation: poll the URL (the page's pushState happens in the main
    // world; polling location.href catches it from the isolated world).
    function checkUrl() {
      if (recording && location.href !== lastUrl) {
        lastUrl = location.href
        recordNavigation()
      }
    }

    let urlTimer: ReturnType<typeof setInterval> | null = null

    function activate(emitNav: boolean) {
      if (recording) return
      recording = true
      document.addEventListener("pointerdown", onPointerDown, true)
      document.addEventListener("click", onClick, true)
      document.addEventListener("focusout", onFocusOut, true)
      urlTimer = setInterval(checkUrl, 800)
      showPill()
      // A fresh page load while recording IS a navigation step.
      if (emitNav) recordNavigation()
    }

    function deactivate() {
      recording = false
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("click", onClick, true)
      document.removeEventListener("focusout", onFocusOut, true)
      if (urlTimer) clearInterval(urlTimer)
      removePill()
    }

    function showPill() {
      if (document.getElementById(PILL_ID)) return
      const pill = document.createElement("div")
      pill.id = PILL_ID
      pill.setAttribute("style", [
        "position:fixed",
        "bottom:20px",
        "left:50%",
        "transform:translateX(-50%)",
        "z-index:2147483647",
        "display:flex",
        "align-items:center",
        "gap:10px",
        "padding:8px 14px",
        "border-radius:999px",
        "background:#1C1D1A",
        "color:#F2F2EE",
        "font:500 13px/1 ui-sans-serif,system-ui,sans-serif",
        "box-shadow:0 4px 20px rgba(0,0,0,.3)",
      ].join(";"))
      const dot = document.createElement("span")
      dot.setAttribute("style", "width:9px;height:9px;border-radius:50%;background:#E5484D;animation:__tacto_pulse 1.4s infinite")
      const label = document.createElement("span")
      label.textContent = "Recording"
      const stop = document.createElement("button")
      stop.textContent = "Stop"
      stop.setAttribute("style", "margin-left:4px;padding:4px 10px;border:0;border-radius:999px;background:#E5484D;color:#fff;font:600 12px ui-sans-serif,system-ui;cursor:pointer")
      stop.addEventListener("click", () => {
        void safeSendMessage({ type: "STOP" })
      })
      const style = document.createElement("style")
      style.textContent = "@keyframes __tacto_pulse{0%{opacity:1}50%{opacity:.3}100%{opacity:1}}"
      pill.append(dot, label, stop, style)
      document.body.appendChild(pill)
    }

    function removePill() {
      document.getElementById(PILL_ID)?.remove()
    }

    // On (re)load, ask the background whether this tab is being recorded.
    void safeSendMessage<{ recording?: boolean }>({
      type: "GET_RECORDING",
    }).then((r) => {
      if (r?.recording) activate(true) // arrived via navigation → nav step
    })

    chrome.runtime.onMessage.addListener(
      (
        msg: { type: string; recording?: boolean; visible?: boolean },
        _sender,
        sendResponse: (r?: unknown) => void
      ) => {
        if (msg.type === "SET_RECORDING") {
          if (msg.recording) activate(false)
          else deactivate()
          return
        }
        if (msg.type === "PILL") {
          const pill = document.getElementById(PILL_ID)
          if (pill) pill.style.opacity = msg.visible ? "1" : "0"
          if (msg.visible) {
            sendResponse(true)
          } else {
            // Ack only after the hide is painted, so the capture excludes it.
            requestAnimationFrame(() =>
              requestAnimationFrame(() => sendResponse(true))
            )
          }
          return true
        }
      }
    )
  },
})
