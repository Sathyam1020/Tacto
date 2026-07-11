/**
 * Web ↔ extension bridge. Runs only on the Tacto app origin. Lets the web
 * app detect the extension, receive the connect token, list open tabs, and
 * start a recording on a chosen tab — all via window.postMessage, so no
 * extension ID or externally_connectable is needed.
 */
import { extensionAlive } from "@/lib/runtime"

type RelayResult<T> =
  | { ok: true; data: T }
  | { ok: false; severed: boolean }

/** Reject a promise that never settles (a dropped message to a cold SW). */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("relay-timeout")), ms)
    ),
  ])
}

/**
 * One request/response to the background, resilient to the MV3 service worker
 * being asleep: the first message after idle can be dropped or hang while the
 * worker spins up, so we retry with a per-attempt timeout + backoff. Bails
 * immediately (severed) if this script has been orphaned by an extension
 * reload — no amount of retrying reaches a dead context.
 */
async function relay<T>(
  message: unknown,
  attempts = 4
): Promise<RelayResult<T>> {
  for (let i = 0; i < attempts; i++) {
    if (!extensionAlive()) return { ok: false, severed: true }
    try {
      const data = await withTimeout(
        chrome.runtime.sendMessage(message) as Promise<T>,
        1000
      )
      if (data !== undefined) return { ok: true, data }
    } catch {
      // Cold-start drop / channel closed — fall through and retry.
    }
    await new Promise((r) => setTimeout(r, 200 * (i + 1)))
  }
  return { ok: false, severed: !extensionAlive() }
}

export default defineContentScript({
  matches: ["http://localhost:3000/*", "http://127.0.0.1:3000/*"],
  runAt: "document_start",
  main() {
    const origin = location.origin

    function post(message: Record<string, unknown>) {
      window.postMessage({ source: "tacto-ext", ...message }, origin)
    }

    async function announce() {
      // Background momentarily unreachable → still announce presence so the app
      // shows "Connect" (installed) rather than "Install".
      const res = await relay<{
        connected?: boolean
        workspaceName?: string | null
      }>({ type: "GET_CONNECTION" })
      post({
        type: "present",
        connected: res.ok ? (res.data?.connected ?? false) : false,
        workspaceName: res.ok ? (res.data?.workspaceName ?? null) : null,
      })
    }

    window.addEventListener("message", (event) => {
      if (event.source !== window || event.origin !== origin) return
      const data = event.data as
        | {
            source?: string
            type?: string
            token?: string
            tabId?: number
            folderId?: string | null
            nonce?: string
          }
        | undefined
      if (data?.source !== "tacto-web") return

      switch (data.type) {
        case "ping":
          void announce()
          break

        case "connect-token":
          if (typeof data.token === "string") {
            void relay({ type: "CONNECT_TOKEN", token: data.token }).then(() =>
              announce()
            )
          }
          break

        case "list-tabs":
          void relay<{ tabs?: unknown[] }>({ type: "LIST_TABS" }).then((res) => {
            if (res.ok) {
              post({ type: "tabs", nonce: data.nonce, tabs: res.data?.tabs ?? [] })
            } else {
              // Reply (don't leave the app hanging to a timeout) with a reason
              // it can act on — a severed script is fixed by a page reload.
              post({
                type: "error",
                nonce: data.nonce,
                reason: res.severed ? "severed" : "unreachable",
              })
            }
          })
          break

        case "start-on-tab":
          if (typeof data.tabId === "number") {
            void relay({
              type: "START_ON_TAB",
              tabId: data.tabId,
              folderId:
                typeof data.folderId === "string" ? data.folderId : null,
            }).then((res) => {
              if (res.ok) post({ type: "started", nonce: data.nonce })
              else
                post({
                  type: "error",
                  nonce: data.nonce,
                  reason: res.severed ? "severed" : "unreachable",
                })
            })
          }
          break
      }
    })

    // Announce as soon as the page can hear us.
    void announce()
  },
})
