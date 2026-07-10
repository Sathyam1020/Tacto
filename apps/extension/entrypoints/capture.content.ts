import type {
  ClickEvent,
  InputEvent,
  NavigationEvent,
} from "@workspace/contracts/capture"

import { describeElement, maskValue } from "@/lib/selector"
import type { RecordedEvent } from "@/lib/types"

const PILL_ID = "__tacto_recording_pill__"

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

    function viewport() {
      return { w: window.innerWidth, h: window.innerHeight }
    }

    function send(event: RecordedEvent, shot: "pending" | "now" | "none") {
      void chrome.runtime.sendMessage({ type: "RECORD_EVENT", event, shot })
    }

    function recordNavigation() {
      const event: NavigationEvent = {
        type: "navigation",
        timestamp: Date.now(),
        url: location.href,
        pageTitle: document.title,
      }
      send(event, "now")
    }

    function interactiveTarget(el: Element): Element {
      return (
        el.closest(
          "a, button, [role=button], input, select, textarea, [role=menuitem], [role=tab], [role=option], summary, label"
        ) ?? el
      )
    }

    function onMouseDown(e: MouseEvent) {
      if (!recording) return
      // Clicking our own pill must NOT trigger a screenshot — the capture
      // hides the pill mid-click, which would swallow the Stop button click.
      const target = e.target as Element | null
      if (target?.closest(`#${PILL_ID}`)) return
      // Ask the background to grab the pre-click screenshot now.
      void chrome.runtime.sendMessage({ type: "PRE_ACTION" })
    }

    function onClick(e: MouseEvent) {
      if (!recording) return
      const raw = e.target as Element | null
      if (!raw || raw.closest(`#${PILL_ID}`)) return
      const el = interactiveTarget(raw)
      const info = describeElement(el)
      if (!info.text.trim()) return // no label → no signal
      const event: ClickEvent = {
        type: "click",
        timestamp: Date.now(),
        url: location.href,
        pageTitle: document.title,
        viewport: viewport(),
        target: info,
      }
      send(event, "pending")
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
      send(event, "now")
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
      document.addEventListener("mousedown", onMouseDown, true)
      document.addEventListener("click", onClick, true)
      document.addEventListener("focusout", onFocusOut, true)
      urlTimer = setInterval(checkUrl, 800)
      showPill()
      // A fresh page load while recording IS a navigation step.
      if (emitNav) recordNavigation()
    }

    function deactivate() {
      recording = false
      document.removeEventListener("mousedown", onMouseDown, true)
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
        void chrome.runtime.sendMessage({ type: "STOP" })
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
    chrome.runtime
      .sendMessage({ type: "GET_RECORDING" })
      .then((r?: { recording?: boolean }) => {
        if (r?.recording) activate(true) // arrived via navigation → nav step
      })
      .catch(() => {})

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
          if (pill) pill.style.visibility = msg.visible ? "visible" : "hidden"
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
