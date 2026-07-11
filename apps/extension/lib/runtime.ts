/**
 * Content scripts outlive their extension: when the extension is reloaded or
 * updated, an already-injected script keeps running but its bridge to the
 * background is severed. Any `chrome.runtime` call then throws "Extension
 * context invalidated." — and, being synchronous, escapes a bare `.then()`
 * chain as an uncaught error on the page. These helpers turn those calls into
 * no-ops instead (a page reload re-injects a fresh, connected script).
 */

/** True while this script is still attached to a live extension context. */
export function extensionAlive(): boolean {
  try {
    return Boolean(chrome.runtime?.id)
  } catch {
    return false
  }
}

/** sendMessage that never throws/rejects — resolves undefined when severed. */
export async function safeSendMessage<T = unknown>(
  message: unknown
): Promise<T | undefined> {
  if (!extensionAlive()) return undefined
  try {
    return (await chrome.runtime.sendMessage(message)) as T
  } catch {
    return undefined
  }
}
