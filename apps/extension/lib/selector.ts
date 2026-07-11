/**
 * Extract the semantic description of an element for a capture event:
 * a stable-ish CSS selector, a visible label, a role, and nearby context.
 * This is the difference between "click element" and "click **New token**".
 */

const SENSITIVE_NAME = /pass|secret|token|cvv|card|ssn|pin/i

export type ElementInfo = {
  selector: string
  role: string
  text: string
  nearbyContext?: string
  boundingBox: { x: number; y: number; w: number; h: number }
}

/** Prefer stable attributes; fall back to a short nth-of-type path. */
export function cssSelector(el: Element): string {
  if (el.id && /^[a-zA-Z][\w-]*$/.test(el.id)) return `#${el.id}`
  const testId =
    el.getAttribute("data-testid") ?? el.getAttribute("data-test-id")
  if (testId) return `[data-testid="${testId}"]`

  const parts: string[] = []
  let node: Element | null = el
  let depth = 0
  while (node && node.nodeType === 1 && depth < 4) {
    const current: Element = node
    let part = current.tagName.toLowerCase()
    const parent: Element | null = current.parentElement
    if (parent) {
      const sameTag = Array.from(parent.children).filter(
        (c) => c.tagName === current.tagName
      )
      if (sameTag.length > 1) {
        part += `:nth-of-type(${sameTag.indexOf(current) + 1})`
      }
    }
    parts.unshift(part)
    if (current.id) break
    node = parent
    depth++
  }
  return parts.join(" > ")
}

/** Resolve aria-labelledby to the concatenated text of its referenced nodes. */
function ariaLabelledBy(el: Element): string | undefined {
  const ids = el.getAttribute("aria-labelledby")
  if (!ids) return undefined
  const text = ids
    .split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
    .filter(Boolean)
    .join(" ")
    .trim()
  return text || undefined
}

/**
 * Human-visible label, most-specific first. Falls all the way back to a
 * role-based name ("button", "link") so an icon-only control is NEVER left
 * label-less — a blank label used to make the capture engine silently drop
 * the whole click.
 */
export function elementLabel(el: Element): string {
  const aria = el.getAttribute("aria-label")
  if (aria?.trim()) return aria.trim()

  const labelled = ariaLabelledBy(el)
  if (labelled) return labelled

  const text = (el as HTMLElement).innerText?.trim()
  if (text && text.length <= 80) return text

  const attrs = ["placeholder", "title", "alt", "name", "data-tooltip", "data-title", "value"]
  for (const a of attrs) {
    const v = el.getAttribute(a)
    if (v?.trim()) return v.trim()
  }
  // Associated <label> for form controls.
  if (el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
    if (label?.textContent?.trim()) return label.textContent.trim()
  }
  // Icon-only controls: borrow a name from a child image or inline SVG.
  const imgAlt = el.querySelector("img[alt]")?.getAttribute("alt")?.trim()
  if (imgAlt) return imgAlt
  const svg = el.querySelector("svg")
  const svgLabel =
    svg?.getAttribute("aria-label")?.trim() ||
    svg?.querySelector("title")?.textContent?.trim()
  if (svgLabel) return svgLabel

  // Last resort: a longer text run, else a generic role name — anything but "".
  if (text) return text.slice(0, 80)
  return elementRole(el)
}

export function elementRole(el: Element): string {
  const role = el.getAttribute("role")
  if (role) return role
  const tag = el.tagName.toLowerCase()
  if (tag === "a") return "link"
  if (tag === "button") return "button"
  if (tag === "select") return "combobox"
  if (tag === "textarea") return "textbox"
  if (tag === "input") {
    const type = (el as HTMLInputElement).type
    if (["checkbox", "radio", "button", "submit"].includes(type)) return type
    return "textbox"
  }
  return tag
}

/** A short label from an ancestor landmark/section, for disambiguation. */
function nearbyContext(el: Element): string | undefined {
  let node = el.parentElement
  let depth = 0
  while (node && depth < 6) {
    const landmark =
      node.getAttribute("aria-label") ??
      (node.matches("nav, header, main, aside, section, form, dialog")
        ? node.getAttribute("aria-label") ||
          node.querySelector("h1, h2, h3, legend")?.textContent?.trim()
        : undefined)
    if (landmark?.trim()) return landmark.trim().slice(0, 60)
    node = node.parentElement
    depth++
  }
  return undefined
}

/** Collapse internal whitespace/newlines so a label reads as one clean line. */
function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

export function describeElement(el: Element): ElementInfo {
  const rect = el.getBoundingClientRect()
  return {
    selector: cssSelector(el),
    role: elementRole(el),
    text: clean(elementLabel(el)),
    nearbyContext: nearbyContext(el),
    boundingBox: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    },
  }
}

// Interactive controls that carry a strong accessibility signal — used ONLY to
// score capture-time confidence (never to decide resolution/drop, so href-less
// SPA links are unaffected).
const STRONG_INTERACTIVE =
  "a, button, input, select, textarea, summary, [role=button], [role=menuitem], [role=menuitemcheckbox], [role=menuitemradio], [role=tab], [role=option], [role=switch], [role=checkbox], [role=radio], [role=link], [aria-haspopup]"

/** Structural viewport position of a box — pure geometry, no semantics. */
function positionPhrase(box: {
  x: number
  y: number
  w: number
  h: number
}): string {
  const cx = (box.x + box.w / 2) / window.innerWidth
  const cy = (box.y + box.h / 2) / window.innerHeight
  const v = cy < 0.33 ? "top" : cy > 0.66 ? "bottom" : "middle"
  const h = cx < 0.33 ? "left" : cx > 0.66 ? "right" : "center"
  if (v === "middle" && h === "center") return "in the center"
  if (v === "middle") return `on the ${h}`
  if (h === "center") return `at the ${v}`
  return `in the ${v}-${h}`
}

/**
 * Describe a clicked element with a capture-time confidence (structural signals
 * ONLY — is it a native/ARIA control? did the label fall back to a bare role?).
 * An icon-only control with no accessible name gets a geometry-based generic
 * ("button in the top-right") instead of a bare "button", and a low confidence
 * so synthesis phrases it carefully rather than inventing a name. `isGeneric`
 * lets the caller drop a dead click on an unlabeled non-control.
 */
export function describeClick(el: Element): {
  info: ElementInfo
  confidence: number
  isGeneric: boolean
} {
  const info = describeElement(el)
  const isNative = el.matches(STRONG_INTERACTIVE)
  // elementLabel returns the role noun as its last resort → a generic fallback.
  const isGeneric = info.text === elementRole(el)
  if (isGeneric) {
    info.text = `${info.text} ${positionPhrase(info.boundingBox)}`
  }
  const confidence = isNative
    ? isGeneric
      ? 0.4
      : 0.9
    : isGeneric
      ? 0.2
      : 0.6
  return { info, confidence, isGeneric }
}

/** Password / secret fields must never leave the page as plaintext. */
export function maskValue(el: HTMLInputElement, value: string): string {
  if (el.type === "password") return "•••"
  const name = `${el.name} ${el.id} ${el.getAttribute("aria-label") ?? ""}`
  if (SENSITIVE_NAME.test(name)) return "•••"
  return value.slice(0, 120)
}
