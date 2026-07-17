export type CompareRow = { feature: string; tacto: boolean | string; them: boolean | string }

export type Comparison = {
  slug: string
  name: string
  title: string
  subtitle: string
  description: string
  intro: string
  /** At-a-glance matrix. Order is shared across competitors. */
  rows: CompareRow[]
  /** Why teams pick Tacto (about Tacto — defensible). */
  advantages: { title: string; body: string }[]
  /** Honest note on where the competitor is a good fit. */
  theirStrength: string
  faqs: { q: string; a: string }[]
}

const FEATURES = [
  "Auto-captured step-by-step guides",
  "Interactive click-through walkthroughs",
  "AI-written steps",
  "Branded help center on your domain",
  "Completion & drop-off analytics",
  "Automatic PII redaction",
  "Voice-over narration",
  "Interactive mode on the free plan",
] as const

/** Tacto is ✓ across the board (all shipped features). */
function rows(them: (boolean | string)[]): CompareRow[] {
  return FEATURES.map((feature, i) => ({ feature, tacto: true, them: them[i] ?? "—" }))
}

export const COMPARISONS: Comparison[] = [
  {
    slug: "scribe",
    name: "Scribe",
    title: "Tacto vs Scribe",
    subtitle: "Both auto-capture your clicks. Only one also gives you interactive demos and a branded help center.",
    description:
      "Tacto vs Scribe: a fair comparison of two step-by-step guide tools. See how Tacto adds interactive walkthroughs, a branded help center, and completion analytics on top of auto-captured guides.",
    intro:
      "Scribe popularized auto-generated how-to guides, and it's a solid pick for quick internal step lists. Tacto starts from the same capture-first idea, then goes further: every recording is also an interactive walkthrough, and your guides can live in a branded help center on your own domain with real completion analytics.",
    rows: rows([true, "Limited", true, "—", "Basic", true, "—", "—"]),
    advantages: [
      { title: "Interactive, not just static", body: "Every Tacto capture is also a spotlighted, click-through walkthrough — not only a scrollable screenshot list." },
      { title: "A real help center", body: "Publish guides to a searchable, branded knowledge base on your own domain, not just individual pages." },
      { title: "Analytics that matter", body: "See completion and drop-off per guide, so you know which docs actually resolve the question." },
    ],
    theirStrength:
      "Scribe is a great fit if all you need is fast, no-frills internal step lists and you're already standardized on it.",
    faqs: [
      { q: "Is Tacto a Scribe alternative?", a: "Yes. Tacto captures step-by-step guides the same way and adds interactive walkthroughs, a branded help center, voice-over, and completion analytics." },
      { q: "Can I import my Scribe guides?", a: "The fastest path is to re-record — a capture takes as long as doing the task once, and you get fresh screenshots plus the interactive version automatically." },
    ],
  },
  {
    slug: "guidejar",
    name: "Guidejar",
    title: "Tacto vs Guidejar",
    subtitle: "Two close peers for interactive guides. Here's how to choose.",
    description:
      "Tacto vs Guidejar: an honest comparison of two interactive guide and help-center tools. Compare interactive walkthroughs, AI, analytics, pricing, and the free plan.",
    intro:
      "Guidejar and Tacto are close peers — both do auto-captured guides, interactive walkthroughs, AI-written steps, and hosted help centers. The right choice usually comes down to the free plan, AI-credit limits, and how each one's interactive player and analytics feel on your own content.",
    rows: rows([true, true, true, true, true, true, true, "Varies"]),
    advantages: [
      { title: "Interactive on the free plan", body: "Tacto's free tier includes the interactive walkthrough mode, so you can evaluate the thing that matters most before paying." },
      { title: "Completion-first analytics", body: "Tacto leads with completion and drop-off, not just view counts — the signal you actually act on." },
      { title: "One capture, three outputs", body: "Every recording becomes a scroll guide, an interactive walkthrough, and a PDF without re-authoring." },
    ],
    theirStrength:
      "Guidejar is a strong, mature product. If you've already invested in it and it fits your workflow, there's no urgent reason to switch — try both on the same recording and compare.",
    faqs: [
      { q: "Is Tacto similar to Guidejar?", a: "Very — both do interactive guides and help centers. The differences are in the free plan, AI-credit limits, analytics depth, and the feel of the interactive player." },
      { q: "How should I decide between them?", a: "Record the same real workflow in both and compare the output, the interactive mode, and the analytics on your own content." },
    ],
  },
  {
    slug: "supademo",
    name: "Supademo",
    title: "Tacto vs Supademo",
    subtitle: "Great interactive demos — plus the internal documentation Supademo isn't built for.",
    description:
      "Tacto vs Supademo: compare interactive demo tools. See how Tacto matches Supademo's demos and adds a branded help center and SOP-ready documentation.",
    intro:
      "Supademo is strong at interactive product demos, especially for sales and marketing. Tacto covers that same interactive demo use case and is equally at home with internal documentation — SOP libraries, onboarding hubs, and a searchable help center on your own domain.",
    rows: rows([true, true, true, "—", true, true, "Varies", "Varies"]),
    advantages: [
      { title: "Demos and docs in one", body: "Use Tacto for external interactive demos and internal SOPs, so you're not paying for two separate tools." },
      { title: "A branded help center", body: "Host a searchable knowledge base on your own domain — not just standalone demo links." },
      { title: "Built for maintenance", body: "Re-record a changed step and the guide refreshes, keeping large libraries accurate over time." },
    ],
    theirStrength:
      "Supademo is an excellent choice if your only job is polished external product demos and you don't need a documentation hub.",
    faqs: [
      { q: "Does Tacto do interactive demos like Supademo?", a: "Yes. Tacto's interactive mode spotlights each step and lets viewers click through the real interface." },
      { q: "Can Tacto also handle internal SOPs?", a: "Yes — that's a core use case. Publish SOPs and onboarding guides to a branded, searchable help center." },
    ],
  },
  {
    slug: "tango",
    name: "Tango",
    title: "Tacto vs Tango",
    subtitle: "Quick step capture — plus interactive walkthroughs and a place to host them.",
    description:
      "Tacto vs Tango: compare step-by-step guide tools. See how Tacto adds interactive walkthroughs, a branded help center, and analytics beyond Tango's browser capture.",
    intro:
      "Tango is a lightweight way to capture how-to steps in the browser, and it's genuinely quick for one-off internal guides. Tacto covers that same fast capture and adds interactive walkthroughs, a hosted help center, and completion analytics — the pieces you need once documentation becomes a system, not a one-off.",
    rows: rows([true, "—", true, "—", "Basic", true, "—", "Varies"]),
    advantages: [
      { title: "Interactive walkthroughs", body: "Beyond static step lists, every Tacto capture becomes a clickable, spotlighted demo." },
      { title: "A home for your guides", body: "Organize everything into a branded, searchable help center instead of scattered links." },
      { title: "Know what's working", body: "Completion and drop-off analytics show where readers succeed or stall." },
    ],
    theirStrength:
      "Tango is a good fit for quick, individual how-to guides when you don't need interactive demos or a hosted knowledge base.",
    faqs: [
      { q: "Is Tacto a Tango alternative?", a: "Yes. Tacto captures guides just as quickly and adds interactive walkthroughs, a help center, and analytics." },
      { q: "Does Tacto work in the browser?", a: "Yes — capture from a browser extension, then publish as a guide, interactive walkthrough, or PDF." },
    ],
  },
  {
    slug: "arcade",
    name: "Arcade",
    title: "Tacto vs Arcade",
    subtitle: "Polished demos — plus AI-written steps and a documentation home.",
    description:
      "Tacto vs Arcade: compare interactive demo tools. See how Tacto matches Arcade's interactive demos and adds AI-written step-by-step guides and a branded help center.",
    intro:
      "Arcade is design-forward and popular for highly polished marketing demos. Tacto covers interactive demos too, and pairs them with AI-written step-by-step guides, a branded help center, and completion analytics — so the same tool serves marketing and internal documentation.",
    rows: rows([true, true, "Varies", "—", true, "Varies", "—", "Varies"]),
    advantages: [
      { title: "AI writes the steps", body: "Tacto auto-writes one clear instruction per action, so guides aren't just visuals — they're readable and searchable." },
      { title: "Documentation, not just demos", body: "Publish SOPs, onboarding, and support guides to a branded help center alongside your demos." },
      { title: "One capture, many formats", body: "Turn a recording into an interactive walkthrough, a scroll guide, and a PDF at once." },
    ],
    theirStrength:
      "Arcade shines when the deliverable is a highly polished, animated marketing demo and you don't need a maintained knowledge base.",
    faqs: [
      { q: "Does Tacto make interactive demos like Arcade?", a: "Yes. Tacto's interactive mode lets viewers click through the product, spotlighted step by step." },
      { q: "Can Tacto also produce written guides?", a: "Yes — AI writes a step per action, so every capture is also a readable, searchable step-by-step guide." },
    ],
  },
]

export function getComparison(slug: string): Comparison | undefined {
  return COMPARISONS.find((c) => c.slug === slug)
}
