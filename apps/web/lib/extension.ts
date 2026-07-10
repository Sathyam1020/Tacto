"use client"

import * as React from "react"

/**
 * Web ↔ extension messaging over window.postMessage (the extension's app
 * bridge content script relays to its background). No extension ID needed.
 */

export type ExtensionState =
  | "unknown"
  | "not-installed"
  | "not-connected"
  | "connected"

export type BrowserTab = {
  id: number
  title: string
  url: string
  favIconUrl: string | null
}

let nonceCounter = 0
function nextNonce(): string {
  nonceCounter += 1
  return `tacto-${Date.now()}-${nonceCounter}`
}

function post(message: Record<string, unknown>) {
  window.postMessage(
    { source: "tacto-web", ...message },
    window.location.origin
  )
}

/** One request/response round-trip to the extension, matched by nonce. */
function request<T>(
  type: string,
  responseType: string,
  extract: (data: Record<string, unknown>) => T,
  timeoutMs = 4000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const nonce = nextNonce()
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error("The Tacto extension didn't respond"))
    }, timeoutMs)
    function onMessage(event: MessageEvent) {
      if (event.source !== window || event.origin !== window.location.origin)
        return
      const data = event.data as Record<string, unknown> | undefined
      if (
        data?.source !== "tacto-ext" ||
        data.type !== responseType ||
        data.nonce !== nonce
      )
        return
      cleanup()
      resolve(extract(data))
    }
    function cleanup() {
      clearTimeout(timer)
      window.removeEventListener("message", onMessage)
    }
    window.addEventListener("message", onMessage)
    post({ type, nonce })
  })
}

export function listTabs(): Promise<BrowserTab[]> {
  return request("list-tabs", "tabs", (d) => (d.tabs as BrowserTab[]) ?? [])
}

export function startOnTab(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const nonce = nextNonce()
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error("Couldn't start recording"))
    }, 4000)
    function onMessage(event: MessageEvent) {
      if (event.source !== window || event.origin !== window.location.origin)
        return
      const data = event.data as Record<string, unknown> | undefined
      if (data?.source !== "tacto-ext" || data.type !== "started" || data.nonce !== nonce)
        return
      cleanup()
      resolve()
    }
    function cleanup() {
      clearTimeout(timer)
      window.removeEventListener("message", onMessage)
    }
    window.addEventListener("message", onMessage)
    post({ type: "start-on-tab", tabId, nonce })
  })
}

/**
 * Detect the extension + its connection state. `unknown` while detecting;
 * settles to `not-installed` if the bridge never announces.
 */
export function useExtension() {
  const [state, setState] = React.useState<ExtensionState>("unknown")
  const [workspaceName, setWorkspaceName] = React.useState<string | null>(null)

  React.useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== window || event.origin !== window.location.origin)
        return
      const data = event.data as
        | { source?: string; type?: string; connected?: boolean; workspaceName?: string | null }
        | undefined
      if (data?.source !== "tacto-ext" || data.type !== "present") return
      setState(data.connected ? "connected" : "not-connected")
      setWorkspaceName(data.workspaceName ?? null)
    }
    window.addEventListener("message", onMessage)
    // Ask the bridge to announce; keep asking briefly in case it loads late.
    const pings = [0, 300, 800].map((d) =>
      setTimeout(() => post({ type: "ping" }), d)
    )
    const settle = setTimeout(
      () => setState((s) => (s === "unknown" ? "not-installed" : s)),
      1600
    )
    return () => {
      window.removeEventListener("message", onMessage)
      pings.forEach(clearTimeout)
      clearTimeout(settle)
    }
  }, [])

  return { state, workspaceName }
}
