import { useCallback, useEffect, useState } from "react"

import { APP_URL } from "@/lib/api"
import type { PopupMessage } from "@/lib/messages"
import type { Status } from "@/lib/types"

function send(message: PopupMessage): Promise<Status> {
  return chrome.runtime.sendMessage(message) as Promise<Status>
}

export function App() {
  const [status, setStatus] = useState<Status | null>(null)

  const refresh = useCallback(async () => {
    setStatus(await send({ type: "GET_STATUS" }))
  }, [])

  useEffect(() => {
    void refresh()
    // Poll so the popup reflects recording progress and connect handoff.
    const t = setInterval(refresh, 1000)
    return () => clearInterval(t)
  }, [refresh])

  function connect() {
    void chrome.tabs.create({ url: `${APP_URL}/extension/connect` })
  }

  async function start() {
    setStatus(await send({ type: "START" }))
  }

  async function stop() {
    setStatus(await send({ type: "STOP" }))
  }

  async function disconnect() {
    setStatus(await send({ type: "DISCONNECT" }))
  }

  return (
    <div className="wrap">
      <div className="brand">
        <Mark />
        Tacto
      </div>
      <div className="divider" />

      {!status ? (
        <p className="muted">Loading…</p>
      ) : !status.connected ? (
        <>
          <p className="muted">
            Connect the extension to your Tacto account to start capturing.
          </p>
          <button className="btn" onClick={connect} style={{ marginTop: 12 }}>
            Connect Tacto
          </button>
        </>
      ) : status.recording ? (
        <>
          <div className="row">
            <span className="dot" />
            <strong>Recording</strong>
            <span className="mono" style={{ marginLeft: "auto" }}>
              {status.eventCount} steps
            </span>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            Do your workflow, then stop. You can close this popup.
          </p>
          <button className="btn danger" onClick={stop} style={{ marginTop: 12 }}>
            Stop &amp; create guide
          </button>
        </>
      ) : status.lastCaptureUrl ? (
        <>
          <p className="muted">
            Capture submitted. Tacto is writing your guide.
          </p>
          <a
            className="link"
            href={status.lastCaptureUrl}
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-block", marginTop: 8 }}
          >
            Open in Tacto →
          </a>
          <button
            className="btn secondary"
            onClick={start}
            style={{ marginTop: 12 }}
          >
            New capture
          </button>
        </>
      ) : (
        <>
          <p className="mono">{status.workspaceName ?? "…"}</p>
          <p className="muted" style={{ marginTop: 4 }}>
            Record a workflow once — Tacto writes the guide.
          </p>
          <button className="btn" onClick={start} style={{ marginTop: 12 }}>
            Start capture
          </button>
          <button
            className="btn secondary"
            onClick={disconnect}
            style={{ marginTop: 8 }}
          >
            Disconnect
          </button>
        </>
      )}

      {status?.error && <p className="error">{status.error}</p>}
    </div>
  )
}

function Mark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9.5" strokeWidth="2.5" stroke="currentColor" />
      <circle cx="15.5" cy="8.5" r="3.25" fill="#0e7c5b" />
    </svg>
  )
}
