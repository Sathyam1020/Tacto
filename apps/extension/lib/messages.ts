import type { RecordedEvent } from "./types"

/** capture content script → background */
export type ContentMessage =
  | { type: "PRE_ACTION" }
  | { type: "RECORD_EVENT"; event: RecordedEvent; shot: "pending" | "now" | "none" }
  | { type: "GET_RECORDING" }
  | { type: "STOP" }

/** app content-script bridge (Tacto web page) → background */
export type BridgeMessage =
  | { type: "CONNECT_TOKEN"; token: string }
  | { type: "LIST_TABS" }
  | { type: "START_ON_TAB"; tabId: number }
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
