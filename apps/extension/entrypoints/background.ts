import type { CaptureEvent } from "@workspace/contracts/capture"

import {
  APP_URL,
  createCapture,
  fetchMe,
  getScreenshotUrls,
  submitCapture,
  uploadShot,
} from "@/lib/api"
import type { Message } from "@/lib/messages"
import type { RecordedEvent, Status } from "@/lib/types"

/**
 * Recorder brain. Lives in the (ephemeral) service worker, so connection
 * state is persisted to chrome.storage and restored via `ready`. Buffers
 * events + screenshots during recording; on stop, uploads to R2 and submits.
 */
export default defineBackground(() => {
  let token: string | null = null
  let workspaceName: string | null = null
  let recording = false
  let recordingTabId: number | null = null
  let recordingWindowId: number | null = null
  // Folder the resulting guide should land in (chosen on the web at start).
  let recordingFolderId: string | null = null
  let events: RecordedEvent[] = []
  let shots: string[] = []
  let pendingShot: Promise<string | null> | null = null
  let lastCaptureUrl: string | null = null
  let error: string | null = null

  // Restore connection across SW restarts. Every handler awaits this first.
  const ready = chrome.storage.local
    .get(["token", "workspaceName"])
    .then((v) => {
      if (typeof v.token === "string") token = v.token
      if (typeof v.workspaceName === "string") workspaceName = v.workspaceName
    })

  function status(): Status {
    return {
      connected: !!token,
      workspaceName,
      recording,
      eventCount: events.length,
      lastCaptureUrl,
      error,
    }
  }

  function sendToTab(tabId: number, message: unknown): Promise<unknown> {
    return chrome.tabs.sendMessage(tabId, message).catch(() => undefined)
  }

  /** Capture the visible tab WITHOUT the recording pill (hide → shot → show). */
  async function captureShot(): Promise<string | null> {
    if (recordingWindowId === null || recordingTabId === null) return null
    try {
      // Wait for the pill to be painted-hidden before capturing.
      await sendToTab(recordingTabId, { type: "PILL", visible: false })
      return await chrome.tabs.captureVisibleTab(recordingWindowId, {
        format: "png",
      })
    } catch {
      return null
    } finally {
      void sendToTab(recordingTabId, { type: "PILL", visible: true })
    }
  }

  function setBadge(on: boolean) {
    chrome.action.setBadgeText({ text: on ? "REC" : "" })
    chrome.action.setBadgeBackgroundColor({ color: "#E5484D" })
  }

  async function loadWorkspace() {
    if (!token) return
    try {
      const me = await fetchMe(token)
      workspaceName = me.workspace.name
      chrome.storage.local.set({ workspaceName })
    } catch (e) {
      // Only disconnect on a real auth failure — not a transient network blip.
      if ((e as { status?: number }).status === 401) {
        token = null
        workspaceName = null
        chrome.storage.local.remove(["token", "workspaceName"])
        error = "Disconnected — reconnect the extension"
      }
    }
  }

  async function startRecording(tabId?: number, folderId?: string | null) {
    await ready
    recordingFolderId = folderId ?? null
    let tab: chrome.tabs.Tab | undefined
    if (tabId != null) {
      tab = await chrome.tabs.get(tabId).catch(() => undefined)
    } else {
      ;[tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    }
    if (!tab?.id) {
      error = "No tab to record"
      return
    }
    recording = true
    recordingTabId = tab.id
    recordingWindowId = tab.windowId
    events = []
    shots = []
    pendingShot = null
    lastCaptureUrl = null
    error = null
    setBadge(true)

    // Switch to the chosen tab so the user can perform the workflow there.
    if (tabId != null) {
      await chrome.tabs.update(tab.id, { active: true }).catch(() => {})
      await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {})
    }

    // Ensure the capture script is present (tabs opened before install don't
    // have it). The script self-guards against double-init.
    await chrome.scripting
      .executeScript({
        target: { tabId: tab.id },
        files: ["content-scripts/capture.js"],
      })
      .catch(() => {})

    void sendToTab(tab.id, { type: "SET_RECORDING", recording: true })
  }

  async function stopAndSubmit() {
    await ready
    recording = false
    setBadge(false)
    if (recordingTabId !== null) {
      void sendToTab(recordingTabId, { type: "SET_RECORDING", recording: false })
    }

    if (!token) {
      error = "Not connected"
      return
    }
    if (events.length === 0) {
      error = "No actions were captured"
      return
    }
    // A Tacto guide is screenshots + pointers — no shots, no guide. Stop here
    // so we never create a capture that can only fail downstream.
    if (shots.length === 0) {
      error = "No screenshots were captured — try recording again"
      return
    }

    try {
      const firstNav = events.find((e) => e.type === "navigation")
      const title = firstNav?.pageTitle ?? "Untitled capture"
      const { captureId } = await createCapture(token, title, recordingFolderId)

      if (shots.length > 0) {
        const { urls } = await getScreenshotUrls(token, captureId, shots.length)
        await Promise.all(
          shots.map((dataUrl, i) => uploadShot(urls[i]!.uploadUrl, dataUrl))
        )
        for (const event of events) {
          if (event._shotIndex !== undefined) {
            event.screenshotId = urls[event._shotIndex]!.key
          }
        }
      }

      const clean: CaptureEvent[] = events.map(({ _shotIndex, ...e }) => {
        void _shotIndex
        return e
      })
      await submitCapture(token, captureId, clean)

      lastCaptureUrl = `${APP_URL}/home`
      events = []
      shots = []
    } catch (e) {
      error = e instanceof Error ? e.message : "Could not submit capture"
    }
  }

  chrome.runtime.onMessage.addListener(
    (message: Message, sender, sendResponse) => {
      switch (message.type) {
        case "CONNECT_TOKEN": {
          token = message.token
          workspaceName = null
          error = null
          chrome.storage.local.set({ token: message.token })
          void loadWorkspace().then(() => sendResponse(status()))
          return true
        }

        case "GET_STATUS":
        case "GET_CONNECTION": {
          void (async () => {
            await ready
            if (token && !workspaceName) await loadWorkspace()
            sendResponse(status())
          })()
          return true
        }

        case "START": {
          void startRecording().then(() => sendResponse(status()))
          return true
        }

        case "START_ON_TAB": {
          void startRecording(message.tabId, message.folderId).then(() =>
            sendResponse(status())
          )
          return true
        }

        case "STOP": {
          void stopAndSubmit().then(() => sendResponse(status()))
          return true
        }

        case "DISCONNECT": {
          token = null
          workspaceName = null
          chrome.storage.local.remove(["token", "workspaceName"])
          sendResponse(status())
          return true
        }

        case "LIST_TABS": {
          void chrome.tabs.query({}).then((tabs) => {
            sendResponse({
              tabs: tabs
                .filter((t) => t.id != null && t.url && /^https?:/.test(t.url))
                .map((t) => ({
                  id: t.id,
                  title: t.title ?? t.url,
                  url: t.url,
                  favIconUrl: t.favIconUrl ?? null,
                })),
            })
          })
          return true
        }

        case "GET_RECORDING": {
          sendResponse({
            recording: recording && sender.tab?.id === recordingTabId,
          })
          return true
        }

        case "PRE_ACTION": {
          if (recording && sender.tab?.id === recordingTabId) {
            pendingShot = captureShot()
          }
          return false
        }

        case "RECORD_EVENT": {
          if (!recording || sender.tab?.id !== recordingTabId) return false
          const event = message.event
          void (async () => {
            let dataUrl: string | null = null
            if (message.shot === "pending") {
              dataUrl = pendingShot ? await pendingShot : await captureShot()
              pendingShot = null
            } else if (message.shot === "now") {
              dataUrl = await captureShot()
            }
            if (dataUrl) {
              shots.push(dataUrl)
              event._shotIndex = shots.length - 1
            }
            events.push(event)
          })()
          return false
        }
      }
    }
  )
})
