/**
 * A minimal, pure past/present/future history for the editor's document. The
 * editor commits discrete edits (add/delete/reorder/customize) and *amends* the
 * present during coalesced text typing so a burst becomes one undo step. Pure
 * and dependency-free so it is trivially testable.
 */
export type History<T> = {
  past: T[]
  present: T
  future: T[]
}

/** Cap the undo depth so long sessions don't grow memory without bound. */
const MAX_HISTORY = 100

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] }
}

function trim<T>(past: T[]): T[] {
  return past.length > MAX_HISTORY ? past.slice(past.length - MAX_HISTORY) : past
}

/** Record a discrete edit: the current present moves to `past`, and the redo
 *  stack is cleared (editing forks a new branch). */
export function commit<T>(h: History<T>, next: T): History<T> {
  return { past: trim([...h.past, h.present]), present: next, future: [] }
}

/** Replace the present without adding a history entry — used to coalesce a
 *  burst of typing into a single undo step. Also forks (clears redo). */
export function amend<T>(h: History<T>, next: T): History<T> {
  return { past: h.past, present: next, future: [] }
}

export function undo<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h
  const prev = h.past[h.past.length - 1] as T
  return {
    past: h.past.slice(0, -1),
    present: prev,
    future: [h.present, ...h.future],
  }
}

export function redo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h
  const next = h.future[0] as T
  return {
    past: trim([...h.past, h.present]),
    present: next,
    future: h.future.slice(1),
  }
}

export const canUndo = <T>(h: History<T>): boolean => h.past.length > 0
export const canRedo = <T>(h: History<T>): boolean => h.future.length > 0

/** Number of committed edits from the seeded state (the navbar's edit count). */
export const editCount = <T>(h: History<T>): number => h.past.length
