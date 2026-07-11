import type { Settle } from "@workspace/contracts/capture"

import type { RecordedEvent } from "./types"

/** capture content script → background. `seq` correlates an event with its frames. */
export type ContentMessage =
  | { type: "PRE_ACTION"; seq: number }
  | {
      type: "RECORD_EVENT"
      event: RecordedEvent
      seq: number
      shot: "pending" | "now" | "none"
    }
  | { type: "POST_ACTION"; seq: number; settle: Settle; capture: boolean }
  | { type: "GET_RECORDING" }
  | { type: "STOP" }

/** app content-script bridge (Tacto web page) → background */
export type BridgeMessage =
  | { type: "CONNECT_TOKEN"; token: string }
  | { type: "LIST_TABS" }
  | { type: "START_ON_TAB"; tabId: number; folderId?: string | null }
  | { type: "GET_CONNECTION" }

/** popup → background */
export type PopupMessage =
  | { type: "GET_STATUS" }
  | { type: "START" }
  | { type: "STOP" }
  | { type: "DISCONNECT" }

/** background → capture content script */
export type BackgroundMessage =
  | { type: "SET_RECORDING"; recording: boolean }
  | { type: "PILL"; visible: boolean }

export type Message = ContentMessage | BridgeMessage | PopupMessage
