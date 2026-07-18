/** Persisted analytics-consent decision (marketing/anonymous visitors). Logged-in
 *  users are covered by the ToS and consent automatically. */
const KEY = "tacto_analytics_consent"

export type Consent = "granted" | "denied"

export function getConsent(): Consent | null {
  if (typeof window === "undefined") return null
  try {
    const v = window.localStorage.getItem(KEY)
    return v === "granted" || v === "denied" ? v : null
  } catch {
    return null
  }
}

export function setConsent(value: Consent): void {
  try {
    window.localStorage.setItem(KEY, value)
  } catch {
    /* storage blocked — treat as undecided */
  }
}
