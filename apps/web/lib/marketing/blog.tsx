import type { ReactNode } from "react"

/** A published blog post: front-matter metadata + a JSX body. Authored in TS so
 *  there's no MDX/markdown dependency and every post is fully type-checked and
 *  server-rendered. */
export type BlogPost = {
  slug: string
  title: string
  description: string
  /** ISO date (YYYY-MM-DD). */
  date: string
  readingMinutes: number
  tags: string[]
  author: string
  /** Surfaced in the "Featured" row on the index. */
  featured?: boolean
  Body: () => ReactNode
}

const AUTHOR = "The Tacto Team"

export const POSTS: BlogPost[] = [
  {
    slug: "turn-any-workflow-into-a-guide",
    title: "How to turn any workflow into a step-by-step guide (without writing it)",
    description:
      "The fastest documentation is the kind you never write. Here's how to capture a process once and let AI produce the guide, the walkthrough, and the screenshots for you.",
    date: "2026-06-24",
    readingMinutes: 6,
    tags: ["Process Documentation", "Tools"],
    author: AUTHOR,
    featured: true,
    Body: () => (
      <>
        <p>
          Most documentation dies for the same reason: writing it is a second job. You finish the actual task, then
          you're expected to open a doc, retrace every click from memory, take screenshots, crop them, annotate them,
          and keep the whole thing current as the interface changes. Nobody has time for that, so the knowledge stays
          in one person's head — until they're on vacation and everything stops.
        </p>
        <p>
          There's a better order of operations: <strong>do the task once with a recorder running</strong>, and let the
          tooling reconstruct the guide. This is what Tacto is built for, but the approach matters more than the tool.
          Here's the workflow.
        </p>
        <h2>1. Record the real thing, not a rehearsal</h2>
        <p>
          The best guide is a recording of the actual work — not a staged demo on dummy data. Start the capture, then
          complete the process the way you normally would. Every click, field, and page change is captured with its own
          screenshot and the exact element you interacted with.
        </p>
        <p>
          Don't narrate or slow down. The point of capture-first documentation is that it costs you nothing on top of
          the work you were already doing.
        </p>
        <h2>2. Let AI write one step per action</h2>
        <p>
          This is where the time savings live. Instead of you describing what you did, the AI reads the captured
          events and writes a single imperative instruction for each one — &ldquo;Click <strong>New form</strong>,&rdquo;
          &ldquo;Name it <strong>Onboarding survey</strong>,&rdquo; &ldquo;Publish and copy the link.&rdquo; Each step is
          paired with the screenshot from that exact moment, with the click marked on the image.
        </p>
        <p>
          Good AI documentation also knows what to leave out: the mis-clicks, the tab you opened by accident, the three
          seconds you spent looking for a button. A clean guide is as much about omission as description.
        </p>
        <h2>3. Publish it three ways from one capture</h2>
        <p>
          A single recording should give you options. The same capture becomes a scrollable step-by-step article for
          people who want to skim, an interactive walkthrough for people who learn by doing, and a PDF for the ones who
          still print things. You choose per audience — you don't re-author per format.
        </p>
        <blockquote>
          The goal isn't to write documentation faster. It's to stop writing it at all, and still ship something better
          than what you'd have written by hand.
        </blockquote>
        <h2>4. Keep it current by re-recording, not editing</h2>
        <p>
          Interfaces drift. When a button moves or a screen is redesigned, the traditional fix is to hunt through a doc
          for stale screenshots. The capture-first fix is faster: re-record the part that changed and swap it in. The
          instructions regenerate; the screenshots are fresh by definition.
        </p>
        <p>
          Do this consistently and your documentation stops being a debt you service and becomes a byproduct of doing
          the work — which is the only kind of documentation that stays alive.
        </p>
      </>
    ),
  },
  {
    slug: "scribe-alternatives",
    title: "5 Scribe alternatives for step-by-step guides in 2026",
    description:
      "Scribe popularized auto-generated how-to guides, but it isn't the only option — or the best fit for every team. A practical comparison of five tools, and how to choose.",
    date: "2026-06-11",
    readingMinutes: 8,
    tags: ["Tools"],
    author: AUTHOR,
    featured: true,
    Body: () => (
      <>
        <p>
          Scribe made auto-captured how-to guides mainstream, and for a lot of teams it's a fine default. But
          &ldquo;captures your clicks&rdquo; is now table stakes — the real differences are in interactive playback,
          branding, help-center hosting, analytics, and price. If you're evaluating alternatives, here are five worth a
          look and how to think about the trade-offs.
        </p>
        <h2>What to actually compare</h2>
        <p>Before the list, the axes that separate these tools once you get past the demo:</p>
        <ul>
          <li><strong>Interactive walkthroughs</strong> — a clickable, spotlighted demo, not just a static screenshot list.</li>
          <li><strong>Branding & hosting</strong> — remove the vendor watermark, use your own domain, host a real help center.</li>
          <li><strong>Analytics</strong> — completion and drop-off, not just view counts.</li>
          <li><strong>Redaction</strong> — automatic blurring of PII and secrets in screenshots.</li>
          <li><strong>Price at team scale</strong> — the per-seat cost when you add ten people, not one.</li>
        </ul>
        <h2>1. Tacto</h2>
        <p>
          Capture-first like Scribe, but every recording also becomes an <strong>interactive walkthrough</strong> — a
          spotlighted, click-through demo — and a branded help center on your own domain. The AI writes one step per
          action, marks the click on each screenshot, and can narrate the whole thing. Strong analytics (completion and
          drop-off, not just views) and a free tier that includes the interactive mode.
        </p>
        <h2>2. Guidejar</h2>
        <p>
          A close peer with polished interactive demos and a help-center product. Good customization and export options.
          A reasonable pick if you want demos and docs from one tool; compare the AI-credit limits and per-seat pricing
          against your volume.
        </p>
        <h2>3. Supademo</h2>
        <p>
          Leans hardest into the interactive product-demo use case, especially for sales and marketing teams embedding
          demos on landing pages. Less oriented around internal SOP libraries, so weigh it by whether your primary job is
          external demos or internal documentation.
        </p>
        <h2>4. Tango</h2>
        <p>
          Clean, lightweight step capture that lives largely in the browser extension. Great for quick internal
          how-tos; lighter on interactive playback and hosted help centers than the others here.
        </p>
        <h2>5. Arcade</h2>
        <p>
          Demo-focused and design-forward, popular with product-marketing teams that want highly polished, animated
          demos. Best when the deliverable is a marketing artifact rather than a maintained knowledge base.
        </p>
        <h2>How to choose</h2>
        <p>
          If your job is <strong>internal documentation and SOPs</strong>, prioritize unlimited guides, a hosted help
          center, and redaction. If it's <strong>external demos</strong>, prioritize interactive playback and embedding.
          If it's <strong>both</strong>, pick a tool that does interactive walkthroughs and a branded help center from a
          single capture — that's the axis where you'll otherwise end up paying for two products.
        </p>
        <p>
          Whatever you choose, insist on trying it on a real workflow, not the sample. The tool that produces the
          cleanest guide from <em>your</em> messiest process is the one that will actually get used.
        </p>
      </>
    ),
  },
  {
    slug: "sop-library-with-ai",
    title: "Build your team's entire SOP library with AI",
    description:
      "Standard operating procedures are the highest-leverage docs a team can have — and the ones most likely to be missing. A repeatable system for building the whole library fast.",
    date: "2026-05-28",
    readingMinutes: 7,
    tags: ["SOPs & Documentation", "Team Productivity"],
    author: AUTHOR,
    featured: true,
    Body: () => (
      <>
        <p>
          Every team has a list of &ldquo;things only Priya knows how to do.&rdquo; Closing the books, provisioning a
          new hire's accounts, publishing the release notes, running the monthly report. Each one is a single point of
          failure, and each one is a standard operating procedure waiting to be written. The problem is never
          motivation — it's that writing forty SOPs by hand is a quarter's worth of nobody's favorite work.
        </p>
        <p>Here's a system that gets the whole library done in days, not quarters.</p>
        <h2>Step 1: Inventory the recurring work</h2>
        <p>
          Ask each person on the team for the five tasks they'd have to explain if they went on leave tomorrow. Don't
          overthink categories — you're looking for anything that's done more than once and lives in someone's head.
          You'll end up with a list of thirty to sixty candidate SOPs surprisingly quickly.
        </p>
        <h2>Step 2: Capture, don't write</h2>
        <p>
          Assign each task to whoever does it and have them record it <strong>the next time they do it for real</strong>.
          This is the crucial reframing: nobody sits down to &ldquo;write an SOP.&rdquo; They do their job with a
          recorder on, once, and the draft writes itself — one step per click, screenshots included.
        </p>
        <p>
          Because the cost is near zero, you get coverage you'd never get from a &ldquo;please document your process&rdquo;
          email. The work happens anyway; you're just capturing it.
        </p>
        <h2>Step 3: Review, redact, and standardize</h2>
        <p>Now a human does the small, high-value part that AI shouldn't:</p>
        <ul>
          <li>Skim the AI-written steps and fix anything ambiguous.</li>
          <li>Redact any PII, customer data, or credentials that appeared on screen.</li>
          <li>Apply a consistent title format so the library is searchable.</li>
        </ul>
        <p>This takes minutes per SOP because you're editing a clean draft, not authoring from a blank page.</p>
        <h2>Step 4: Put it all in one findable place</h2>
        <p>
          A library nobody can find is just files. Publish the SOPs to a single branded help center with search, grouped
          by team or function. The test: a new hire should be able to answer &ldquo;how do I do X?&rdquo; without
          messaging a human.
        </p>
        <blockquote>
          An SOP library isn't a documentation project. It's an insurance policy against every person on your team being
          irreplaceable in the bad way.
        </blockquote>
        <h2>Step 5: Keep it alive</h2>
        <p>
          Make re-recording part of the process itself: when someone notices a step is wrong, they re-capture that task
          on the spot instead of filing a ticket. Because capture is cheap, corrections happen in the moment — which is
          the only way a library of forty documents stays accurate over a year.
        </p>
      </>
    ),
  },
  {
    slug: "interactive-demos-that-convert",
    title: "Interactive product demos that actually convert",
    description:
      "A static screenshot tells buyers about your product. An interactive demo lets them try it. Here's what separates a demo that drives signups from one that gets skipped.",
    date: "2026-05-14",
    readingMinutes: 5,
    tags: ["Product Marketing"],
    author: AUTHOR,
    featured: false,
    Body: () => (
      <>
        <p>
          The best salesperson for your product is the product itself — but only if a buyer can reach it. An interactive
          demo bridges the gap between &ldquo;read about it&rdquo; and &ldquo;book a call,&rdquo; letting a prospect click
          through the real thing at their own pace. Done well, it's the highest-converting asset on a marketing site.
          Done poorly, it's a glorified GIF. Here's the difference.
        </p>
        <h2>Let them drive</h2>
        <p>
          A demo that auto-plays and can't be touched is a video. The moment that converts is when the buyer clicks the
          highlighted element themselves and something responds — that small interaction is what makes the product feel
          real and within reach. Spotlight the next action, then get out of the way.
        </p>
        <h2>Show the outcome, not the tour</h2>
        <p>
          Buyers don't want a menu tour; they want to see themselves getting a result. Structure the demo around the one
          job they came to do — create the thing, share the thing, see the payoff — and cut everything that isn't on that
          path. A tight seven-step demo beats a comprehensive thirty-step one every time.
        </p>
        <h2>Put it above the fold, and everywhere else</h2>
        <p>
          The demo shouldn't be buried on a &ldquo;product&rdquo; page. Embed it in the hero, in the relevant feature
          sections, and in your outbound emails. Each embed is a chance for a buyer to try before they ask.
        </p>
        <h2>Measure completion, not plays</h2>
        <p>
          A play count tells you a demo loaded. A completion rate tells you whether it worked. Watch where people drop
          off — if half of them leave at step four, step four is either confusing or boring, and no amount of traffic
          fixes that. Treat the demo like a funnel and iterate on it like one.
        </p>
        <p>
          The teams that win with interactive demos treat them as a product surface, not a marketing decoration — built
          from a real capture, focused on one outcome, and tuned by the numbers.
        </p>
      </>
    ),
  },
  {
    slug: "reduce-time-to-value-saas",
    title: "How to reduce time-to-value in SaaS onboarding",
    description:
      "Time-to-value is the clock between signup and the first real payoff. Shortening it is the highest-leverage retention work you can do — and most of it is a documentation problem.",
    date: "2026-04-30",
    readingMinutes: 6,
    tags: ["Customer Onboarding"],
    author: AUTHOR,
    featured: false,
    Body: () => (
      <>
        <p>
          Time-to-value (TTV) is the time between a user signing up and experiencing the outcome they signed up for. It
          is one of the few metrics that correlates cleanly with retention: the faster a user reaches their first real
          win, the more likely they are to still be around in ninety days. Most of the work of lowering it is, quietly, a
          documentation and guidance problem.
        </p>
        <h2>Define the one activation moment</h2>
        <p>
          Before you can shorten the path, name the destination. For most products there's a single activation
          moment — the first sent message, the first published page, the first connected integration — that predicts
          retention. Pick it deliberately and design onboarding backward from it. Everything that doesn't move a user
          toward that moment is a candidate for cutting.
        </p>
        <h2>Replace &ldquo;explore&rdquo; with a guided path</h2>
        <p>
          An empty dashboard with a &ldquo;get started&rdquo; button asks the user to do the hard work of figuring out
          your product. A guided walkthrough does the opposite: it puts the next action in front of them, spotlighted,
          and lets them take it. In-context guidance beats a help doc in another tab because it removes the switch cost
          entirely.
        </p>
        <h2>Answer questions before they're asked</h2>
        <p>
          Every support ticket in the first week is a TTV leak. Instrument your onboarding to see where people stall,
          then place a short guide exactly there — inside the product, at the moment of confusion. A self-serve answer at
          the point of friction is worth ten articles in a knowledge base nobody visits.
        </p>
        <blockquote>
          You don't lower time-to-value by making your product simpler. You lower it by making the next step obvious.
        </blockquote>
        <h2>Measure the clock, then move it</h2>
        <p>
          Track the median time from signup to activation as a first-class metric, cohort it, and watch it move as you
          ship guidance. When you place a walkthrough on the critical path and the median drops, you've done retention
          work that no amount of feature development would have bought you.
        </p>
      </>
    ),
  },
]

export function allPosts(): BlogPost[] {
  // Newest first.
  return [...POSTS].sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function getPost(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug)
}

export function featuredPosts(): BlogPost[] {
  return allPosts().filter((p) => p.featured)
}

export function allTags(): string[] {
  return [...new Set(POSTS.flatMap((p) => p.tags))].sort()
}

/** "June 24, 2026" from an ISO date, in a fixed locale so SSR and client agree. */
export function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })
}
