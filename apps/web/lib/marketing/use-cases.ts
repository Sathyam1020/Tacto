import {
  BarChart3,
  BookOpen,
  Boxes,
  FileText,
  GraduationCap,
  Headset,
  Languages,
  LayoutGrid,
  Library,
  Lock,
  Megaphone,
  MousePointerClick,
  RefreshCw,
  Rocket,
  Search,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react"

export type UseCase = {
  slug: string
  icon: LucideIcon
  /** Short menu label. */
  label: string
  title: string
  subtitle: string
  /** Meta description. */
  description: string
  intro: string
  pains: string[]
  capabilities: { icon: LucideIcon; title: string; body: string }[]
  outcomes: string[]
  faqs: { q: string; a: string }[]
}

export const USE_CASES: UseCase[] = [
  {
    slug: "onboarding",
    icon: GraduationCap,
    label: "Employee onboarding",
    title: "Onboard new hires without shadowing.",
    subtitle: "Turn tribal knowledge into a self-serve path people can follow on day one.",
    description:
      "Ramp new hires faster with Tacto. Record every internal process once and hand new employees a self-serve library of step-by-step guides and interactive walkthroughs — no shadowing, no repeated demos.",
    intro:
      "The first two weeks of any job are a scavenger hunt for information that lives in other people's heads. Onboarding with Tacto replaces the shadowing sessions and the “just ask Priya” loop with a library new hires can work through at their own pace — captured once, from the real tools your team actually uses.",
    pains: [
      "The same walkthrough gets delivered live to every new hire, forever.",
      "Written onboarding docs go stale the moment a UI changes.",
      "Knowledge lives with senior people, so ramp time depends on their availability.",
    ],
    capabilities: [
      { icon: MousePointerClick, title: "Interactive walkthroughs", body: "New hires click through the real interface, spotlighted step by step, instead of watching someone else do it." },
      { icon: LayoutGrid, title: "A branded onboarding hub", body: "Group guides by team and role in a searchable help center on your own domain — the single place a new hire starts." },
      { icon: RefreshCw, title: "Always current", body: "When a tool changes, re-record the step that moved. The instructions and screenshots refresh instead of rotting." },
    ],
    outcomes: [
      "Cut ramp time by handing over a path, not a person's calendar.",
      "Free senior staff from repeating the same demo every hire.",
      "Give every new employee the same complete, consistent start.",
    ],
    faqs: [
      { q: "How is this different from recording a Loom?", a: "A video can't be skimmed, searched, or clicked through, and it's obsolete the instant the UI changes. Tacto produces step-by-step guides and interactive walkthroughs you can navigate, search, and update per-step." },
      { q: "Can we organize guides by team or role?", a: "Yes. Group guides into collections in a branded help center so a new hire in support sees the support path and an engineer sees theirs." },
      { q: "Do new hires need an account to view guides?", a: "No. Guides can be shared by link or embedded, and viewers never need to sign in." },
    ],
  },
  {
    slug: "support",
    icon: Headset,
    label: "Customer support",
    title: "Answer “how do I…?” before it's a ticket.",
    subtitle: "Resolve the question with a guide that does the explaining for you.",
    description:
      "Deflect repetitive support tickets with Tacto. Turn every “how do I…?” into a step-by-step guide or interactive walkthrough your customers can self-serve — and drop the answer straight into a reply.",
    intro:
      "Support teams answer the same handful of questions thousands of times. Tacto turns each of those answers into a guide once, so the next customer self-serves and your team spends its time on the problems that actually need a human.",
    pains: [
      "Agents retype the same step-by-step answer over and over.",
      "Screenshots in the help center are outdated and confusing.",
      "There's no data on which articles actually resolve the question.",
    ],
    capabilities: [
      { icon: Search, title: "A searchable help center", body: "Publish guides to a branded, searchable knowledge base your customers reach before they ever open a ticket." },
      { icon: FileText, title: "Drop-in reply answers", body: "Paste a guide link into any ticket. The customer gets a clear, clickable walkthrough instead of a wall of text." },
      { icon: BarChart3, title: "See what resolves", body: "Completion and drop-off analytics show which guides land and which need work — so you improve the ones that matter." },
    ],
    outcomes: [
      "Deflect the repetitive tickets that don't need a human.",
      "Cut resolution time with answers customers can follow themselves.",
      "Keep every screenshot current without a rewrite.",
    ],
    faqs: [
      { q: "Can I embed guides inside my existing help desk?", a: "Yes. Guides embed anywhere with an iframe, so they live inside Zendesk, Intercom, your docs, or your product UI." },
      { q: "Will customers see a Tacto watermark?", a: "On paid plans you remove Tacto branding entirely and host on your own domain, so the help center is fully yours." },
      { q: "Can I tell which guides deflect the most tickets?", a: "Analytics show views, completion, and drop-off per guide, so you can see which answers are doing the work." },
    ],
  },
  {
    slug: "sops",
    icon: ScrollText,
    label: "SOPs & documentation",
    title: "SOPs that write themselves and stay true.",
    subtitle: "Capture how work actually gets done — once — and keep it current.",
    description:
      "Build and maintain your SOP library with Tacto. Record each process once and AI writes the standard operating procedure, screenshots included — then keep it accurate by re-recording, not rewriting.",
    intro:
      "Standard operating procedures are the highest-leverage documents a team can have and the ones most likely to be missing, because writing them by hand is nobody's favorite work. Tacto flips the cost: people record a task while doing it for real, and the SOP writes itself.",
    pains: [
      "“Please document your process” emails never get answered.",
      "The SOPs that do exist are wrong within a quarter.",
      "Critical processes live in one person's head — a single point of failure.",
    ],
    capabilities: [
      { icon: Sparkles, title: "AI-written procedures", body: "Record the task once; the AI writes one clear step per action, with the click marked on every screenshot." },
      { icon: ShieldCheck, title: "Redaction built in", body: "Automatically blur PII, customer data, and credentials that appear on screen before a procedure is shared." },
      { icon: RefreshCw, title: "Correct in the moment", body: "When a step is wrong, re-capture it on the spot. Corrections happen in seconds, so the library stays accurate." },
    ],
    outcomes: [
      "Get real coverage of the work only one person knows.",
      "Turn a quarter-long documentation project into a few days.",
      "Keep procedures accurate without a maintenance backlog.",
    ],
    faqs: [
      { q: "How do we redact sensitive data in screenshots?", a: "Business plans include automatic PII redaction, and you can manually blur any region on any screenshot before publishing." },
      { q: "Can we enforce a consistent format across SOPs?", a: "Yes. Apply consistent titles, branding, and structure across the library so it's searchable and predictable." },
      { q: "What happens when a process changes?", a: "Re-record the affected steps. The instructions regenerate and the screenshots are fresh by definition — no manual editing hunt." },
    ],
  },
  {
    slug: "product-marketing",
    icon: Megaphone,
    label: "Product marketing",
    title: "Let buyers try the product, not read about it.",
    subtitle: "Interactive demos that convert — embedded wherever buyers are.",
    description:
      "Ship interactive product demos with Tacto. Turn a single capture into a spotlighted, click-through demo you can embed in your hero, feature pages, and outbound — and measure by completion, not plays.",
    intro:
      "The best salesperson for your product is the product itself, if a buyer can reach it. Tacto turns a real capture into an interactive demo prospects click through at their own pace — the asset that bridges “read about it” and “book a call.”",
    pains: [
      "Static screenshots tell buyers about the product but never let them try it.",
      "Demo videos auto-play, can't be touched, and get skipped.",
      "There's no signal on whether a demo actually landed.",
    ],
    capabilities: [
      { icon: MousePointerClick, title: "Click-through demos", body: "Buyers take the next action themselves, spotlighted step by step — the interaction that makes the product feel real." },
      { icon: Boxes, title: "Embed everywhere", body: "Drop the same demo into your hero, feature sections, and emails. Every embed is a chance to try before asking." },
      { icon: BarChart3, title: "Measure completion", body: "Watch where buyers drop off and iterate on the demo like a funnel — not a vanity play count." },
    ],
    outcomes: [
      "Turn passive page visitors into active product triers.",
      "Give sales a self-serve demo to send before every call.",
      "Improve the demo with real completion data.",
    ],
    faqs: [
      { q: "Where can I embed the demo?", a: "Anywhere that accepts an iframe — landing pages, feature pages, blog posts, and email. It's the same capture, reused." },
      { q: "Can the demo be interactive rather than a video?", a: "Yes. Interactive mode spotlights each target and lets the viewer click through the real interface at their own pace." },
      { q: "How do I know if a demo is working?", a: "Completion and drop-off analytics show exactly where viewers stop, so you can fix the step that's losing them." },
    ],
  },
  {
    slug: "it",
    icon: Wrench,
    label: "IT & helpdesk",
    title: "A guide for every internal tool.",
    subtitle: "Cut repeat IT requests with self-serve answers that stay current.",
    description:
      "Reduce repetitive IT tickets with Tacto. Document every internal tool and request — VPN setup, access requests, password resets — as a step-by-step guide employees can follow themselves.",
    intro:
      "IT teams field the same requests on a loop: set up the VPN, request access, reset the password, configure the laptop. Tacto turns each of those into a guide once, so employees self-serve and IT gets its time back for the work that isn't repeatable.",
    pains: [
      "The same setup requests come in every week from every new hire.",
      "Internal tools change constantly, so docs are perpetually stale.",
      "Screenshots of admin panels leak sensitive configuration.",
    ],
    capabilities: [
      { icon: Search, title: "A self-serve IT hub", body: "A searchable help center for every internal tool and request, so employees find the answer before filing a ticket." },
      { icon: Lock, title: "Safe to share", body: "Auto-redact tokens, emails, and configuration that appear in admin screenshots before a guide goes out." },
      { icon: RefreshCw, title: "Fast to maintain", body: "When an internal tool changes, re-record the step. No hunting through a wiki for the outdated screenshot." },
    ],
    outcomes: [
      "Deflect the repeatable setup and access requests.",
      "Keep internal documentation current with minimal effort.",
      "Share admin walkthroughs without leaking secrets.",
    ],
    faqs: [
      { q: "Can we restrict who sees internal guides?", a: "Yes. Guides can be password-protected, and a help center can sit behind SSO on Business plans." },
      { q: "How do we avoid leaking secrets in screenshots?", a: "Automatic PII redaction plus manual blur let you scrub tokens and configuration before anything is shared." },
      { q: "Does this integrate with our help desk?", a: "Guides embed anywhere, so they live inside your existing ITSM or ticketing tool." },
    ],
  },
  {
    slug: "training",
    icon: BookOpen,
    label: "Training",
    title: "Courses people actually finish.",
    subtitle: "Hands-on training built from real workflows, not slide decks.",
    description:
      "Create hands-on training with Tacto. Turn real workflows into interactive, click-through lessons and step-by-step guides that people finish — with completion analytics to prove it.",
    intro:
      "Most training is a slide deck someone clicks through and forgets. Tacto builds training from the real thing: interactive walkthroughs where learners perform each step themselves, grouped into a course they can actually complete — and that you can measure.",
    pains: [
      "Slide-based training doesn't stick because nobody does anything.",
      "Building courses by hand takes weeks of screenshots and editing.",
      "There's no way to know who completed a course, or where they gave up.",
    ],
    capabilities: [
      { icon: MousePointerClick, title: "Learn by doing", body: "Interactive walkthroughs make learners take each action, spotlighted — the format that actually builds recall." },
      { icon: Languages, title: "Translate instantly", body: "Publish the same course in multiple languages from one capture, so distributed teams learn in their own." },
      { icon: Users, title: "Prove completion", body: "See who finished and where people dropped off, so you can fix the lesson instead of guessing." },
    ],
    outcomes: [
      "Replace passive decks with hands-on, memorable lessons.",
      "Build a full course in days from real workflows.",
      "Measure completion instead of hoping it happened.",
    ],
    faqs: [
      { q: "Can training be interactive rather than watched?", a: "Yes. Interactive mode has learners click through the real interface step by step, which is far stickier than video." },
      { q: "Can we offer training in multiple languages?", a: "Guides can be translated, so one capture becomes a course in every language your team needs." },
      { q: "Can we track who completed training?", a: "Completion and drop-off analytics show engagement per guide and per course." },
    ],
  },
  {
    slug: "knowledge-base",
    icon: Library,
    label: "Knowledge base",
    title: "A knowledge base customers actually use.",
    subtitle: "A branded, searchable help center on your own domain — built from real captures.",
    description:
      "Build a knowledge base with Tacto. Publish step-by-step guides and interactive walkthroughs to a branded, searchable help center on your own domain, with completion analytics on every article.",
    intro:
      "Most knowledge bases are a graveyard of stale articles nobody can find. Tacto builds one from the work itself: capture a process once, and the guide is ready to publish to a branded, searchable help center on your own domain — where customers land before they ever open a ticket.",
    pains: [
      "Articles are walls of text with screenshots that went stale two releases ago.",
      "Customers can't find the answer, so they file a ticket anyway.",
      "There's no data on which articles resolve the question and which waste everyone's time.",
    ],
    capabilities: [
      { icon: Search, title: "Searchable and self-serve", body: "Every guide lands in a searchable help center customers reach first, so the answer is found before a ticket is filed." },
      { icon: LayoutGrid, title: "Branded, on your domain", body: "Host the knowledge base on your own domain with your branding — no Tacto watermark, fully yours on paid plans." },
      { icon: BarChart3, title: "See what resolves", body: "Completion and drop-off analytics per article show which answers land, so you improve the ones that matter." },
    ],
    outcomes: [
      "Deflect the repetitive questions with answers customers can find.",
      "Keep every article's screenshots current by re-recording, not rewriting.",
      "Invest in the articles the data says are doing the work.",
    ],
    faqs: [
      { q: "Can I host the knowledge base on my own domain?", a: "Yes. On paid plans you publish to a branded help center on your own domain, with Tacto branding removed." },
      { q: "How is this different from a static docs site?", a: "Every article can be an interactive, click-through walkthrough — not just text — and each one carries completion analytics." },
      { q: "How do we keep articles from going stale?", a: "When a step changes, re-record it. The instructions regenerate and the screenshots are fresh by definition." },
    ],
  },
  {
    slug: "process-documentation",
    icon: Workflow,
    label: "Process documentation",
    title: "Document how work gets done — automatically.",
    subtitle: "Capture a process once and get clean, current documentation, screenshots included.",
    description:
      "Process documentation software that writes itself. Record any workflow once with Tacto and AI turns it into clear, screenshot-rich documentation you keep current by re-recording, not rewriting.",
    intro:
      "Process documentation is the work everyone agrees is important and nobody wants to write, so it stays trapped in people's heads. Tacto changes the economics: capture a workflow while doing it for real, and the AI writes the documentation — one clear step per action, screenshots marked, ready to publish.",
    pains: [
      "Writing documentation by hand competes with the actual work, so it never happens.",
      "The docs that exist drift out of date the moment a tool changes.",
      "Undocumented processes live with one person — a single point of failure.",
    ],
    capabilities: [
      { icon: MousePointerClick, title: "Capture, don't write", body: "Record the workflow once from the browser; the documentation comes out the other side instead of starting from a blank page." },
      { icon: Sparkles, title: "AI-written steps", body: "One clear instruction per action, with the click marked on every screenshot, so the doc is readable and searchable." },
      { icon: RefreshCw, title: "Current by re-recording", body: "When a process changes, re-capture the step that moved. The text and screenshots refresh instead of rotting." },
    ],
    outcomes: [
      "Get real coverage of the processes only one person knows.",
      "Turn a quarter-long documentation project into a few days.",
      "Keep documentation accurate without a maintenance backlog.",
    ],
    faqs: [
      { q: "How is this different from your SOP use case?", a: "Same engine — SOPs are one kind of process documentation. Use this for any technical or operational workflow you need captured and kept current." },
      { q: "Can we redact sensitive data in screenshots?", a: "Yes. Automatic PII redaction plus manual blur scrub credentials, customer data, and configuration before anything is shared." },
      { q: "Where does the documentation live?", a: "Publish it to a branded, searchable help center on your own domain, or embed any guide inside your existing wiki or tools." },
    ],
  },
  {
    slug: "user-onboarding",
    icon: Rocket,
    label: "User onboarding",
    title: "Get new users to their first win, faster.",
    subtitle: "Interactive walkthroughs that guide users to activation — in your product and your docs.",
    description:
      "User onboarding software built on real product captures. Guide new users with interactive, click-through walkthroughs you can embed in your product and help center, and measure activation with completion analytics.",
    intro:
      "New users decide fast whether your product is worth the effort, and a wall of documentation isn't the thing that convinces them. Tacto turns a real capture into an interactive walkthrough that spotlights each step and lets users click through to their first win — embedded right where they get stuck.",
    pains: [
      "New users bounce before they reach the moment the product clicks.",
      "Static docs and demo videos don't get users to actually do the thing.",
      "There's no signal on where users stall on the path to activation.",
    ],
    capabilities: [
      { icon: MousePointerClick, title: "Interactive walkthroughs", body: "Users click through the real interface, spotlighted step by step, instead of reading about it or watching a video." },
      { icon: Boxes, title: "Embed in your product", body: "Drop the same walkthrough into your app, help center, or emails with an iframe — right where a user needs it." },
      { icon: BarChart3, title: "Measure activation", body: "Completion and drop-off analytics show exactly where users stall, so you fix the step that's losing them." },
    ],
    outcomes: [
      "Guide users to first value instead of hoping they find it.",
      "Reuse one capture across in-app onboarding, docs, and email.",
      "Improve the path to activation with real completion data.",
    ],
    faqs: [
      { q: "Can I embed walkthroughs inside my product?", a: "Yes. Guides embed anywhere that accepts an iframe, so an interactive walkthrough can live directly in your app UI." },
      { q: "Is this in-app onboarding or documentation?", a: "Both — the same interactive capture works embedded in your product and published to your help center." },
      { q: "How do I know if onboarding is working?", a: "Completion and drop-off analytics per walkthrough show where users activate and where they give up." },
    ],
  },
]

export function getUseCase(slug: string): UseCase | undefined {
  return USE_CASES.find((u) => u.slug === slug)
}
