import type { CaptureEvent, Interaction } from "@workspace/contracts/capture";

/**
 * Stage 2 — the Interaction Compiler. Turns the normalized event log into an
 * ordered list of INTERACTIONS: groups of raw events that form one meaningful
 * user action. Guide synthesis then writes one step per interaction, so the
 * output reads like a human wrote it — not one line per browser event.
 *
 * LOSSLESS by construction: an interaction *references* its member events by
 * index and never deletes them. Replay / analytics / future consumers still see
 * the full event history; only the guide-facing view is collapsed.
 *
 * Deterministic, structural rules ONLY (provable causality) — never semantic
 * intent. Semantic phrasing ("this is a search") stays in the LLM tier.
 *
 * Rules:
 *  • navigation-absorb — a RUN of consecutive SAME-ORIGIN navigations following
 *    a click is that click's consequence (you clicked; a redirect chain landed
 *    you there): fold the whole run into the click's interaction. Cross-origin
 *    navigations (OAuth, external links) are a context switch the reader should
 *    know about → their own interaction.
 *    FUTURE: stop absorbing at a navigation that introduces a NEW user decision
 *    (2FA, payment-failed, consent) — not deterministically detectable yet, so
 *    same-origin + consecutive + click-caused is the approximation for now.
 */

/** Same web origin? Invalid URLs never match (safe default: don't absorb). */
function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

export function compileInteractions(events: CaptureEvent[]): Interaction[] {
  const interactions: Interaction[] = [];

  events.forEach((event, index) => {
    const prev = interactions[interactions.length - 1];
    const prevEvent = prev ? events[prev.primaryEventIndex] : undefined;

    // navigation-absorb: a run of same-origin navs right after a click are all
    // that click's consequence (redirect chain). Fold each into the click; the
    // recorded destination is the LAST hop the run reached.
    if (
      event.type === "navigation" &&
      prev &&
      prevEvent?.type === "click" &&
      sameOrigin(prevEvent.url, event.url)
    ) {
      prev.eventIndexes.push(index);
      prev.absorbedNavigation = { url: event.url, pageTitle: event.pageTitle };
      // primaryEventIndex stays the click — that's where the reader acts; the
      // destination is shown by the NEXT interaction's screenshot.
      return;
    }

    interactions.push({ eventIndexes: [index], primaryEventIndex: index });
  });

  return interactions;
}
