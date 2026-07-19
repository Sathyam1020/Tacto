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
  {
    slug: "guidde",
    name: "Guidde",
    title: "Tacto vs Guidde",
    subtitle: "Both auto-capture and use AI. Only one turns captures into interactive walkthroughs and a branded help center.",
    description:
      "Tacto vs Guidde: a fair comparison and Guidde alternative. See how Tacto matches AI-captured how-to guides and adds interactive walkthroughs, a branded help center, and interactive mode on the free plan.",
    intro:
      "Guidde is known for AI video documentation with polished voice-over, captured straight from the browser. Tacto captures the same way and leans interactive: every recording becomes a click-through walkthrough, not just a video or scroll doc, and your guides can live in a searchable, branded help center on your own domain.",
    rows: rows([true, "—", true, "Varies", "Basic", true, true, "—"]),
    advantages: [
      { title: "Interactive, not only video", body: "Every Tacto capture is also a spotlighted, click-through walkthrough viewers drive themselves — beyond a linear video or screenshot list." },
      { title: "A branded help center", body: "Publish guides to a searchable knowledge base on your own domain, not just shared video links." },
      { title: "Interactive on the free plan", body: "Evaluate the interactive walkthrough mode — the part that matters most — before you pay." },
    ],
    theirStrength:
      "Guidde is an excellent choice when the deliverable is an AI-narrated how-to video and voice-over is your priority.",
    faqs: [
      { q: "Is Tacto a Guidde alternative?", a: "Yes. Tacto auto-captures AI-written guides the same way and adds interactive walkthroughs, a branded help center, and completion analytics." },
      { q: "Does Tacto have voice-over like Guidde?", a: "Tacto supports voice-over narration; Guidde's AI video voice-over is more central to its product, so compare both on the same recording." },
    ],
  },
  {
    slug: "storylane",
    name: "Storylane",
    title: "Tacto vs Storylane",
    subtitle: "Great interactive demos — plus the auto-captured guides and help center Storylane isn't built for.",
    description:
      "Tacto vs Storylane: compare interactive demo tools and find a Storylane alternative. See how Tacto matches interactive demos and adds auto-captured step-by-step guides and a branded help center.",
    intro:
      "Storylane is strong at interactive product demos for sales and marketing, with solid demo analytics and data masking. Tacto covers that same interactive walkthrough use case and is equally at home with documentation — auto-captured SOPs, onboarding, and a searchable help center on your own domain — so one tool serves both go-to-market and internal knowledge.",
    rows: rows(["—", true, "—", "—", true, true, "—", "Varies"]),
    advantages: [
      { title: "Demos and docs in one", body: "Run external interactive demos and internal SOP/onboarding libraries from the same tool, instead of paying for two." },
      { title: "Capture, don't rebuild", body: "Record a real workflow once and get a guide automatically — no rebuilding the flow screen by screen." },
      { title: "A branded help center", body: "Host a searchable knowledge base on your own domain, not just standalone demo links." },
    ],
    theirStrength:
      "Storylane is a great fit if your only job is polished, sales-led interactive demos and you don't need a documentation hub.",
    faqs: [
      { q: "Is Tacto a Storylane alternative?", a: "Yes. Tacto's interactive mode spotlights each step and lets viewers click through the real product, and it also produces auto-captured guides and a help center." },
      { q: "Can Tacto handle internal documentation too?", a: "Yes — SOPs, onboarding, and support guides publish to a branded, searchable help center, which demo-only tools don't offer." },
    ],
  },
  {
    slug: "navattic",
    name: "Navattic",
    title: "Tacto vs Navattic",
    subtitle: "No-code interactive demos — plus auto-captured guides and a documentation home.",
    description:
      "Tacto vs Navattic: compare interactive demo tools and find a Navattic alternative. See how Tacto matches no-code interactive demos and adds AI-written guides and a branded help center.",
    intro:
      "Navattic is a popular no-code way to build interactive product demos for the website and sales. Tacto covers interactive walkthroughs too, and pairs them with AI-written step-by-step guides and a branded help center — so the same capture serves a marketing demo and an internal SOP without rebuilding anything.",
    rows: rows(["—", true, "—", "—", true, true, "—", "Varies"]),
    advantages: [
      { title: "AI writes the steps", body: "Tacto auto-writes one clear instruction per action, so a capture is also a readable, searchable guide — not only a visual demo." },
      { title: "Documentation, not just demos", body: "Publish SOPs, onboarding, and support content to a branded help center alongside your demos." },
      { title: "One capture, many formats", body: "Turn a recording into an interactive walkthrough, a scroll guide, and a PDF at once." },
    ],
    theirStrength:
      "Navattic shines when the deliverable is a website or sales-led interactive demo and you don't need a maintained knowledge base.",
    faqs: [
      { q: "Is Tacto a Navattic alternative?", a: "Yes. Tacto builds interactive walkthroughs viewers click through, and also produces AI-written guides and a branded help center." },
      { q: "Do I have to rebuild my product in Tacto?", a: "No — Tacto captures your real workflow from the browser, so you don't reconstruct screens the way pure demo builders often require." },
    ],
  },
  {
    slug: "walnut",
    name: "Walnut",
    title: "Tacto vs Walnut",
    subtitle: "Sales-grade interactive demos — plus the auto-captured guides and help center Walnut leaves out.",
    description:
      "Tacto vs Walnut: compare interactive demo platforms and find a Walnut alternative. See how Tacto matches interactive demos and adds auto-captured step-by-step guides and a branded help center.",
    intro:
      "Walnut is built for sales teams running personalized, interactive product demos at scale, with strong demo management and analytics. Tacto covers the interactive walkthrough use case and adds auto-captured documentation — SOP libraries, onboarding, and a searchable help center on your own domain — making it a fit for teams that need demos and docs, not demos alone.",
    rows: rows(["—", true, "—", "—", true, true, "—", "—"]),
    advantages: [
      { title: "Demos and docs in one", body: "Serve external interactive demos and internal knowledge from a single tool instead of a separate demo platform and docs stack." },
      { title: "Capture-first, not rebuild-first", body: "Record the real workflow once and get a guide automatically, rather than reconstructing the product screen by screen." },
      { title: "A branded help center", body: "Publish a searchable knowledge base on your own domain — something sales-demo platforms don't provide." },
    ],
    theirStrength:
      "Walnut is a strong choice for enterprise sales teams whose core need is personalized demo creation and management at scale.",
    faqs: [
      { q: "Is Tacto a Walnut alternative?", a: "Yes — especially if you want interactive demos plus auto-captured guides and a branded help center, rather than a sales-only demo platform." },
      { q: "Does Tacto have a free plan?", a: "Yes, and it includes the interactive walkthrough mode, so you can evaluate the core experience before committing." },
    ],
  },
]

export function getComparison(slug: string): Comparison | undefined {
  return COMPARISONS.find((c) => c.slug === slug)
}
