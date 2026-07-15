import assert from "node:assert/strict"

import { reconcileDraft, type CachedDraft } from "./draft-cache.js"

/** Draft cache reconciliation regression. Run: `npm test -w web`. */

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

const cache = (over: Partial<CachedDraft>): CachedDraft => ({
  document: {
    v: 3,
    title: "",
    summary: null,
    blocks: [],
    interactive: { slides: [], stepPresentation: {} },
    assets: [],
    customization: {} as never,
    faqs: [],
    embeds: [],
  },
  version: 1,
  unsynced: true,
  savedAt: 0,
  ...over,
})

console.log("draft-cache reconcile")

test("no cache → seed from server", () => {
  assert.equal(reconcileDraft(null, 3), "server")
})

test("synced cache → seed from server (authoritative)", () => {
  assert.equal(reconcileDraft(cache({ unsynced: false, version: 3 }), 3), "server")
})

test("unsynced cache on the same version → resume from cache", () => {
  assert.equal(reconcileDraft(cache({ unsynced: true, version: 3 }), 3), "cache")
})

test("unsynced cache but server moved → conflict", () => {
  assert.equal(reconcileDraft(cache({ unsynced: true, version: 3 }), 5), "conflict")
})

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`)
  process.exit(1)
}
console.log("\nAll draft-cache tests passed")
