import type { DraftDocumentClient } from "@/lib/guides"

/**
 * A localStorage mirror of the editor draft. It is a low-latency cache and an
 * offline buffer — never the source of truth (the server draft is). It gives
 * instant resume and holds edits made while offline until they can be synced.
 */
export type CachedDraft = {
  document: DraftDocumentClient
  /** The last server version this cache is based on. */
  version: number
  /** True while it holds edits the server hasn't accepted yet. */
  unsynced: boolean
  savedAt: number
}

const storageKey = (guideId: string) => `tacto:draft:${guideId}`

export function readDraftCache(guideId: string): CachedDraft | null {
  try {
    const raw = localStorage.getItem(storageKey(guideId))
    return raw ? (JSON.parse(raw) as CachedDraft) : null
  } catch {
    return null
  }
}

export function writeDraftCache(guideId: string, cache: CachedDraft): void {
  try {
    localStorage.setItem(storageKey(guideId), JSON.stringify(cache))
  } catch {
    /* quota / private mode — the cache is best-effort */
  }
}

export function clearDraftCache(guideId: string): void {
  try {
    localStorage.removeItem(storageKey(guideId))
  } catch {
    /* ignore */
  }
}

/**
 * Decide what to seed the editor from when a local cache and the server draft
 * both exist. Pure so it's easy to test; the editor performs the effect.
 * - `server`  — nothing local worth keeping; the server is authoritative.
 * - `cache`   — local offline edits on top of the same server version; resume
 *               them and sync.
 * - `conflict`— local offline edits AND the server moved on; ask the user.
 */
export type SeedFrom = "server" | "cache" | "conflict"
export function reconcileDraft(
  cache: CachedDraft | null,
  serverVersion: number
): SeedFrom {
  if (!cache || !cache.unsynced) return "server"
  if (cache.version === serverVersion) return "cache"
  return "conflict"
}
