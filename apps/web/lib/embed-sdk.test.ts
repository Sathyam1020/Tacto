import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

// @ts-expect-error jsdom ships no bundled types and @types/jsdom isn't installed
import { JSDOM } from "jsdom"

/**
 * DOM-level test of the embed.js SDK: inline auto-embed + programmatic embed,
 * popup, origin-checked resize, and event relay. Runs the real public/embed.js
 * inside jsdom.
 */
const code = readFileSync(new URL("../public/embed.js", import.meta.url), "utf8")

function boot(bodyHtml = "") {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><body><script src="http://tacto.test/embed.js"></script>${bodyHtml}</body></html>`,
    { url: "http://host.test/", runScripts: "outside-only", pretendToBeVisual: true }
  )
  const { window } = dom
  window.eval(code)
  // jsdom (outside-only) doesn't auto-fire DOMContentLoaded; the SDK defers its
  // scan to it when the doc is still "loading". Fire it to mirror the browser.
  window.document.dispatchEvent(new window.Event("DOMContentLoaded"))
  return window as unknown as Window & typeof globalThis & { Tacto: any }
}

function msg(window: Window, source: unknown, origin: string, data: unknown) {
  const evt = new (window as any).MessageEvent("message", { data, origin })
  Object.defineProperty(evt, "source", { value: source })
  window.dispatchEvent(evt as Event)
}

let failures = 0
function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (err) {
    failures++
    console.error(`  ✗ ${name}`)
    console.error(err instanceof Error ? err.message : err)
  }
}

console.log("embed.js SDK")

test("exposes the Tacto API", () => {
  const w = boot()
  for (const m of ["embed", "open", "close", "destroy", "on", "off"]) {
    assert.equal(typeof w.Tacto[m], "function", m)
  }
  assert.equal(w.Tacto.origin, "http://tacto.test")
})

test("auto-embeds [data-tacto-guide] with the right iframe src", () => {
  const w = boot(`<div id="a" data-tacto-guide="ABC" data-tacto-mode="interactive" data-tacto-theme="dark"></div>`)
  const iframe = w.document.querySelector("#a iframe") as HTMLIFrameElement
  assert.ok(iframe, "iframe injected")
  assert.match(iframe.src, /^http:\/\/tacto\.test\/embed\/g\/ABC\?/)
  assert.match(iframe.src, /mode=interactive/)
  assert.match(iframe.src, /theme=dark/)
})

test("programmatic embed() injects into a target", () => {
  const w = boot(`<div id="x"></div>`)
  const inst = w.Tacto.embed("#x", { guide: "ZZZ", mode: "list" })
  const iframe = w.document.querySelector("#x iframe") as HTMLIFrameElement
  assert.ok(iframe && inst)
  assert.match(iframe.src, /\/embed\/g\/ZZZ\?mode=list/)
})

test("resize message from the iframe (correct origin) sets height", () => {
  const w = boot(`<div id="x"></div>`)
  const inst = w.Tacto.embed("#x", { guide: "ZZZ" })
  msg(w, inst.iframe.contentWindow, "http://tacto.test", {
    source: "tacto-embed",
    type: "RESIZE",
    payload: { height: 813 },
  })
  assert.equal(inst.iframe.style.height, "813px")
})

test("resize from a WRONG origin is ignored", () => {
  const w = boot(`<div id="x"></div>`)
  const inst = w.Tacto.embed("#x", { guide: "ZZZ" })
  inst.iframe.style.height = "500px"
  msg(w, inst.iframe.contentWindow, "http://evil.test", {
    source: "tacto-embed",
    type: "RESIZE",
    payload: { height: 999 },
  })
  assert.equal(inst.iframe.style.height, "500px")
})

test("relays events to on() listeners", () => {
  const w = boot(`<div id="x"></div>`)
  const inst = w.Tacto.embed("#x", { guide: "ZZZ" })
  let completed = 0
  w.Tacto.on("complete", () => completed++)
  msg(w, inst.iframe.contentWindow, "http://tacto.test", { source: "tacto-embed", type: "COMPLETE", payload: {} })
  assert.equal(completed, 1)
})

test("open() creates a modal dialog; close() removes it", () => {
  const w = boot()
  const pop = w.Tacto.open({ guide: "PPP", mode: "interactive" })
  const dialog = w.document.querySelector('[role="dialog"]')
  assert.ok(dialog, "overlay present")
  assert.ok((dialog as HTMLElement).querySelector("iframe"))
  w.Tacto.close(pop)
  // close animates out on a timer; assert it's scheduled for removal
  assert.equal(pop._open, false)
})

if (failures > 0) {
  console.error(`\n${failures} embed SDK test(s) failed`)
  process.exit(1)
}
console.log("All embed SDK tests passed")
