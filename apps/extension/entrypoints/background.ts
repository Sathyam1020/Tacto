import type { CaptureEvent, Settle } from "@workspace/contracts/capture"

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
 * One recorded event plus its captured frames. `before` is the pre-interaction
 * frame; `after` is the post-settle frame (only when the interaction changed
 * the DOM). Correlated to messages by `seq`. `work` holds the in-flight capture
 * promises so `stop` can await them before uploading.
 */
type Buffered = {
  seq: number
  event: RecordedEvent
  before?: string
  after?: string
  settle?: Settle
  work: Promise<unknown>[]
}

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
  // Ordered event buffer + a seq index for correlating late "after" frames.
  let buffer: Buffered[] = []
  let byId = new Map<number, Buffered>()
  // Pre-click ("before") frames captured on pointerdown, keyed by seq, stamped
  // so a stale one (pointerdown that never became a click) can be discarded.
  let pendingBefore = new Map<
    number,
    { promise: Promise<string | null>; at: number }
  >()
  let lastCaptureUrl: string | null = null
  let error: string | null = null

  // Rate-limit guard for captureVisibleTab (~2/sec). "before" frames are
  // time-critical (pre-click) and fire immediately; the NEW "after" frames go
  // through this serializer so a burst never blows the quota.
  let captureChain: Promise<unknown> = Promise.resolve()
  let lastCaptureAt = 0
  const MIN_AFTER_SPACING_MS = 550

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
      eventCount: buffer.length,
      lastCaptureUrl,
      error,
    }
  }

  function sendToTab(tabId: number, message: unknown): Promise<unknown> {
    return chrome.tabs.sendMessage(tabId, message).catch(() => undefined)
  }

  /**
   * captureVisibleTab is rate-limited by Chrome (a few calls/sec); under rapid
   * clicking some calls throw and the step would lose its screenshot. Retry a
   * couple of times with backoff so a throttled frame recovers instead of
   * dropping.
   */
  async function captureVisible(windowId: number): Promise<string | null> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await chrome.tabs.captureVisibleTab(windowId, { format: "png" })
      } catch {
        if (attempt === 2) return null
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)))
      }
    }
    return null
  }

  /**
   * Capture the visible tab WITHOUT the recording pill. On the pre-click path
   * the content script has already hidden the pill synchronously, so we pass
   * `pillHidden` to skip the hide round-trip — that round-trip is exactly what
   * used to let a click's effect paint before the frame was grabbed.
   */
  async function captureShot(pillHidden = false): Promise<string | null> {
    if (recordingWindowId === null || recordingTabId === null) return null
    try {
      if (!pillHidden) {
        await sendToTab(recordingTabId, { type: "PILL", visible: false })
      }
      return await captureVisible(recordingWindowId)
    } catch {
      return null
    } finally {
      lastCaptureAt = Date.now()
      // Always restore — covers both our hide and the content script's.
      void sendToTab(recordingTabId, { type: "PILL", visible: true })
    }
  }

  /**
   * Capture an "after" frame through the rate-limit serializer: one at a time,
   * spaced ≥ MIN_AFTER_SPACING_MS from the previous capture. "after" frames are
   * not time-critical (the DOM has already settled), so spacing them is free —
   * it keeps us under Chrome's captureVisibleTab quota during bursts.
   */
  function queuedAfterCapture(): Promise<string | null> {
    const run = captureChain.then(async () => {
      const since = Date.now() - lastCaptureAt
      if (since < MIN_AFTER_SPACING_MS) {
        await new Promise((r) => setTimeout(r, MIN_AFTER_SPACING_MS - since))
      }
      return captureShot()
    })
    captureChain = run.catch(() => {})
    return run
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
    buffer = []
    byId = new Map()
    pendingBefore = new Map()
    captureChain = Promise.resolve()
    lastCaptureAt = 0
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
    if (buffer.length === 0) {
      error = "No actions were captured"
      return
    }

    // Wait for every in-flight before/after capture to resolve before we build
    // the upload list (an "after" frame may still be settling when Stop lands).
    await Promise.allSettled(buffer.flatMap((b) => b.work))

    // Flatten all captured frames into one upload list, remembering which slot
    // each belongs to. Byte-identical before/after upload once (dedup).
    type Slot = { b: Buffered; role: "before" | "after" }
    const flat: { dataUrl: string; slots: Slot[] }[] = []
    const seen = new Map<string, number>() // dataUrl → flat index (dedup)
    function place(b: Buffered, role: "before" | "after", dataUrl?: string) {
      if (!dataUrl) return
      const existing = seen.get(dataUrl)
      if (existing !== undefined) {
        flat[existing]!.slots.push({ b, role })
        return
      }
      seen.set(dataUrl, flat.length)
      flat.push({ dataUrl, slots: [{ b, role }] })
    }
    for (const b of buffer) {
      place(b, "before", b.before)
      place(b, "after", b.after)
    }

    // A Tacto guide is screenshots + pointers — no frames, no guide. Stop here
    // so we never create a capture that can only fail downstream.
    if (flat.length === 0) {
      error = "No screenshots were captured — try recording again"
      return
    }

    try {
      const firstNav = buffer.find((b) => b.event.type === "navigation")
      const title = firstNav?.event.pageTitle ?? "Untitled capture"
      const { captureId } = await createCapture(token, title, recordingFolderId)

      const { urls } = await getScreenshotUrls(token, captureId, flat.length)
      await Promise.all(
        flat.map((f, i) => uploadShot(urls[i]!.uploadUrl, f.dataUrl))
      )
      // Attach resolved R2 keys to each event's frame slots + settle facts.
      flat.forEach((f, i) => {
        const key = urls[i]!.key
        for (const { b, role } of f.slots) {
          b.event.frames = { ...b.event.frames, [role]: key }
        }
      })
      for (const b of buffer) {
        if (b.settle) b.event.settle = b.settle
        // Default resolved frame (the worker's selector may override). Keeps the
        // API's "has a screenshot" guard + legacy readers happy.
        b.event.screenshotId =
          b.event.frames?.before ?? b.event.frames?.after ?? b.event.screenshotId
      }

      const clean: CaptureEvent[] = buffer.map((b) => b.event)
      await submitCapture(token, captureId, clean)

      lastCaptureUrl = `${APP_URL}/home`
      buffer = []
      byId = new Map()
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
            // Content script already hid the pill synchronously → capture the
            // pre-click ("before") frame immediately, keyed by seq.
            pendingBefore.set(message.seq, {
              promise: captureShot(true),
              at: Date.now(),
            })
          }
          return false
        }

        case "RECORD_EVENT": {
          if (!recording || sender.tab?.id !== recordingTabId) return false
          const b: Buffered = { seq: message.seq, event: message.event, work: [] }
          buffer.push(b)
          byId.set(message.seq, b)
          const work = (async () => {
            if (message.shot === "pending") {
              // Use the pre-click frame if it's fresh; a stale one belongs to a
              // pointerdown that never produced this click.
              const pb = pendingBefore.get(message.seq)
              pendingBefore.delete(message.seq)
              const fresh = pb && Date.now() - pb.at < 1500
              b.before = (fresh ? await pb!.promise : await captureShot()) ?? undefined
            } else if (message.shot === "now") {
              b.before = (await captureShot()) ?? undefined
            }
          })()
          b.work.push(work)
          return false
        }

        case "POST_ACTION": {
          if (!recording || sender.tab?.id !== recordingTabId) return false
          const b = byId.get(message.seq)
          if (!b) return false
          b.settle = message.settle
          if (message.capture) {
            // Rate-limited "after" capture — the DOM has settled; spacing is free.
            const work = (async () => {
              b.after = (await queuedAfterCapture()) ?? undefined
            })()
            b.work.push(work)
          }
          return false
        }
      }
    }
  )
})
