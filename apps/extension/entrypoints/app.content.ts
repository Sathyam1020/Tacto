/**
 * Web ↔ extension bridge. Runs only on the Tacto app origin. Lets the web
 * app detect the extension, receive the connect token, list open tabs, and
 * start a recording on a chosen tab — all via window.postMessage, so no
 * extension ID or externally_connectable is needed.
 */
export default defineContentScript({
  matches: ["http://localhost:3000/*", "http://127.0.0.1:3000/*"],
  runAt: "document_start",
  main() {
    const origin = location.origin

    function post(message: Record<string, unknown>) {
      window.postMessage({ source: "tacto-ext", ...message }, origin)
    }

    async function announce() {
      let conn:
        | { connected?: boolean; workspaceName?: string | null }
        | undefined
      try {
        conn = (await chrome.runtime.sendMessage({ type: "GET_CONNECTION" })) as
          | { connected?: boolean; workspaceName?: string | null }
          | undefined
      } catch {
        // Background momentarily unreachable — still announce presence so the
        // app shows "Connect" (installed) rather than "Install".
      }
      post({
        type: "present",
        connected: conn?.connected ?? false,
        workspaceName: conn?.workspaceName ?? null,
      })
    }

    window.addEventListener("message", (event) => {
      if (event.source !== window || event.origin !== origin) return
      const data = event.data as
        | { source?: string; type?: string; token?: string; tabId?: number; nonce?: string }
        | undefined
      if (data?.source !== "tacto-web") return

      switch (data.type) {
        case "ping":
          void announce()
          break

        case "connect-token":
          if (typeof data.token === "string") {
            void chrome.runtime
              .sendMessage({ type: "CONNECT_TOKEN", token: data.token })
              .then(() => announce())
          }
          break

        case "list-tabs":
          void chrome.runtime
            .sendMessage({ type: "LIST_TABS" })
            .then((res: { tabs?: unknown[] }) =>
              post({ type: "tabs", nonce: data.nonce, tabs: res?.tabs ?? [] })
            )
          break

        case "start-on-tab":
          if (typeof data.tabId === "number") {
            void chrome.runtime
              .sendMessage({ type: "START_ON_TAB", tabId: data.tabId })
              .then(() => post({ type: "started", nonce: data.nonce }))
          }
          break
      }
    })

    // Announce as soon as the page can hear us.
    void announce()
  },
})
