import assert from "node:assert/strict"

import {
  amend,
  canRedo,
  canUndo,
  commit,
  editCount,
  initHistory,
  redo,
  undo,
} from "./editor-history.js"

/**
 * Editor history reducer regression. Run: `npm test -w web`.
 */

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

console.log("editor-history")

test("init has no past/future", () => {
  const h = initHistory("a")
  assert.equal(h.present, "a")
  assert.equal(canUndo(h), false)
  assert.equal(canRedo(h), false)
  assert.equal(editCount(h), 0)
})

test("commit pushes present to past and clears future", () => {
  let h = initHistory("a")
  h = commit(h, "b")
  assert.equal(h.present, "b")
  assert.deepEqual(h.past, ["a"])
  assert.deepEqual(h.future, [])
  assert.equal(editCount(h), 1)
})

test("undo/redo walk the history", () => {
  let h = initHistory("a")
  h = commit(h, "b")
  h = commit(h, "c")
  assert.equal(h.present, "c")
  h = undo(h)
  assert.equal(h.present, "b")
  h = undo(h)
  assert.equal(h.present, "a")
  assert.equal(canUndo(h), false)
  h = redo(h)
  assert.equal(h.present, "b")
  h = redo(h)
  assert.equal(h.present, "c")
  assert.equal(canRedo(h), false)
})

test("undo/redo at the ends are no-ops", () => {
  let h = initHistory("a")
  assert.equal(undo(h).present, "a")
  h = commit(h, "b")
  h = redo(h) // nothing to redo
  assert.equal(h.present, "b")
})

test("committing after undo clears the redo branch", () => {
  let h = initHistory("a")
  h = commit(h, "b")
  h = commit(h, "c")
  h = undo(h) // present = b, future = [c]
  h = commit(h, "d")
  assert.equal(h.present, "d")
  assert.deepEqual(h.future, [])
  assert.equal(canRedo(h), false)
})

test("amend coalesces typing into one history entry", () => {
  let h = initHistory("")
  h = commit(h, "h") // first keystroke of a burst → checkpoint pre-burst ("")
  h = amend(h, "he")
  h = amend(h, "hel")
  h = amend(h, "hell")
  h = amend(h, "hello")
  assert.equal(h.present, "hello")
  assert.equal(editCount(h), 1) // only one undo step for the whole burst
  h = undo(h)
  assert.equal(h.present, "") // undo jumps to before the burst
})

test("history is capped and preserves the most recent edits", () => {
  let h = initHistory(0)
  for (let i = 1; i <= 150; i++) h = commit(h, i)
  assert.equal(h.present, 150)
  assert.equal(h.past.length, 100) // capped
  assert.equal(h.past[h.past.length - 1], 149) // newest kept
})

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`)
  process.exit(1)
}
console.log("\nAll editor-history tests passed")
