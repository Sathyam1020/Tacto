import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Kbd, KbdGroup } from "@workspace/ui/components/kbd"
import { Label } from "@workspace/ui/components/label"
import { Logo } from "@workspace/ui/components/logo"
import { Separator } from "@workspace/ui/components/separator"
import { StepMarker } from "@workspace/ui/components/step-marker"
import { Switch } from "@workspace/ui/components/switch"
import { TouchRing } from "@workspace/ui/components/touch-ring"

/**
 * Design-system specimen — Tacto's theme rendered live.
 * This page is a working reference, not product UI. It will be replaced by
 * the real app; until then it is the single source of visual truth.
 */

const SWATCHES = [
  { name: "Paper", className: "bg-background border", hex: "#FBFBF8" },
  { name: "Ink", className: "bg-foreground", hex: "#1C1D1A" },
  { name: "Graphite", className: "bg-graphite", hex: "#6E7168" },
  { name: "Hairline", className: "bg-hairline border", hex: "#E9E9E3" },
  { name: "Viridian", className: "bg-viridian", hex: "#0E7C5B" },
  { name: "Signal", className: "bg-signal", hex: "#E5484D" },
] as const

const LIBRARY_ROWS = [
  {
    step: 1,
    title: "Onboard a new customer in Stripe",
    steps: 12,
    duration: "2m 04s",
    date: "Jun 30",
  },
  {
    step: 2,
    title: "Issue a refund without breaking reconciliation",
    steps: 18,
    duration: "4m 12s",
    date: "Jun 28",
  },
  {
    step: 3,
    title: "Export monthly invoices for finance",
    steps: 7,
    duration: "1m 33s",
    date: "Jun 21",
  },
] as const

export default function Page() {
  return (
    <div className="min-h-svh">
      {/* ── App bar ───────────────────────────────────────────────────── */}
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
          <Logo />
          <nav className="text-muted-foreground flex items-center gap-6 text-sm">
            <span className="text-foreground">Library</span>
            <span>Settings</span>
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground font-mono text-xs">
              <Kbd>D</Kbd> theme
            </span>
            <Button>
              <TouchRing size="sm" tone="neutral" />
              Capture
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-32">
        {/* ── Thesis ──────────────────────────────────────────────────── */}
        <section className="pt-20 pb-16">
          <p className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
            Design system · v0.1
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-tight tracking-tight text-balance">
            Ink, paper, and the touch ring.
          </h1>
          <p className="text-muted-foreground mt-6 max-w-xl text-lg leading-relaxed">
            The app is a quiet instrument. The knowledge people create is the
            beautiful object. One motif — a ring around a point of contact —
            signs everything.
          </p>
        </section>

        {/* ── Type roles ──────────────────────────────────────────────── */}
        <SectionHeading>Type</SectionHeading>
        <section className="grid gap-10 py-10 sm:grid-cols-3">
          <div>
            <RoleLabel>Chrome — Schibsted Grotesk</RoleLabel>
            <p className="mt-3 text-2xl font-semibold tracking-tight">
              Publish guide
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Buttons, navigation, settings. Tight, instrument-like.
            </p>
          </div>
          <div>
            <RoleLabel>Knowledge — Newsreader</RoleLabel>
            <p className="mt-3 font-serif text-2xl leading-snug">
              Click <em>New customer</em> in the toolbar.
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Guide titles, step text, the published viewer.
            </p>
          </div>
          <div>
            <RoleLabel>Captured data — Geist Mono</RoleLabel>
            <p className="mt-3 font-mono text-lg">00:42 · step 3/12</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Timestamps, URLs, element labels. The machine&apos;s voice.
            </p>
          </div>
        </section>

        {/* ── Palette ─────────────────────────────────────────────────── */}
        <SectionHeading>Color</SectionHeading>
        <section className="grid grid-cols-3 gap-6 py-10 sm:grid-cols-6">
          {SWATCHES.map((swatch) => (
            <div key={swatch.name}>
              <div className={`h-16 rounded-lg ${swatch.className}`} />
              <p className="mt-2 text-sm font-medium">{swatch.name}</p>
              <p className="text-muted-foreground font-mono text-xs">
                {swatch.hex}
              </p>
            </div>
          ))}
        </section>
        <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
          Viridian appears only where touch lives: primary actions, click
          indicators, focus, links. Signal has exactly one job — the live
          recording state.
        </p>

        {/* ── Primitives ──────────────────────────────────────────────── */}
        <SectionHeading className="mt-16">Primitives</SectionHeading>
        <section className="flex flex-col gap-8 py-10">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Capture</Button>
            <Button variant="secondary">Preview</Button>
            <Button variant="outline">Export</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="destructive">Delete guide</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge>12 steps</Badge>
            <Badge variant="secondary">Draft</Badge>
            <Badge variant="outline">
              <span className="bg-viridian size-1.5 rounded-full" />
              Published
            </Badge>
            <Badge variant="outline" className="text-signal border-signal/30">
              <span className="bg-signal size-1.5 animate-pulse rounded-full" />
              Recording
            </Badge>
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
          </div>
          <div className="flex max-w-md flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="guide-title">Guide title</Label>
              <Input
                id="guide-title"
                defaultValue="Onboard a new customer in Stripe"
                className="font-serif"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="blur-toggle">Blur sensitive fields</Label>
              <Switch id="blur-toggle" defaultChecked />
            </div>
          </div>
        </section>

        {/* ── Library index ───────────────────────────────────────────── */}
        <SectionHeading className="mt-16">Library — an index, not a dashboard</SectionHeading>
        <section className="py-10">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold tracking-tight">
              Engineering
            </h2>
            <span className="text-muted-foreground font-mono text-xs">
              12 guides
            </span>
          </div>
          <div className="mt-4">
            {LIBRARY_ROWS.map((row) => (
              <div key={row.step}>
                <Separator />
                <div className="group flex items-center gap-5 py-5">
                  <StepMarker step={row.step} />
                  <div className="min-w-0 flex-1">
                    <p className="group-hover:text-viridian font-serif text-lg leading-snug transition-colors">
                      {row.title}
                    </p>
                  </div>
                  <div className="text-muted-foreground hidden shrink-0 items-baseline gap-4 font-mono text-xs sm:flex">
                    <span>{row.steps} steps</span>
                    <span>{row.duration}</span>
                    <span>{row.date}</span>
                  </div>
                </div>
              </div>
            ))}
            <Separator />
          </div>
        </section>

        {/* ── A step, as it publishes ─────────────────────────────────── */}
        <SectionHeading className="mt-16">A step, as it publishes</SectionHeading>
        <section className="py-10">
          <div className="flex gap-5">
            <StepMarker step={2} state="current" size="lg" className="mt-1" />
            <div className="min-w-0 flex-1">
              <p className="font-serif text-xl leading-relaxed">
                Click <strong>New customer</strong> in the top-right of the
                Customers page.
              </p>
              <p className="text-muted-foreground mt-1 font-mono text-xs">
                dashboard.stripe.com/customers
              </p>

              {/* Captured screenshot (mocked) with the touch ring on target */}
              <div className="bg-card mt-5 overflow-hidden rounded-xl border">
                <div className="flex items-center gap-1.5 border-b px-4 py-2.5">
                  <span className="bg-border size-2.5 rounded-full" />
                  <span className="bg-border size-2.5 rounded-full" />
                  <span className="bg-border size-2.5 rounded-full" />
                  <span className="bg-muted text-muted-foreground ml-3 rounded-md px-3 py-0.5 font-mono text-[10px]">
                    dashboard.stripe.com
                  </span>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="bg-muted h-4 w-32 rounded" />
                    <div className="relative">
                      <div className="bg-viridian rounded-md px-3 py-1.5 text-xs font-medium text-white">
                        New customer
                      </div>
                      <TouchRing
                        size="lg"
                        className="absolute -top-3 -right-3"
                        label="Click target"
                      />
                    </div>
                  </div>
                  <div className="mt-6 space-y-3">
                    <div className="bg-muted h-3 w-full rounded" />
                    <div className="bg-muted h-3 w-4/5 rounded" />
                    <div className="bg-muted h-3 w-2/3 rounded" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Live states ─────────────────────────────────────────────── */}
        <SectionHeading className="mt-16">Live states</SectionHeading>
        <section className="grid gap-10 py-10 sm:grid-cols-2">
          <div className="flex items-center gap-4">
            <TouchRing variant="pulse" tone="recording" size="lg" label="Recording" />
            <div>
              <p className="font-medium">Recording</p>
              <p className="text-muted-foreground font-mono text-xs">
                00:42 · 6 steps captured
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <TouchRing variant="processing" size="lg" label="Processing capture" />
            <div>
              <p className="font-medium">Writing your guide</p>
              <p className="text-muted-foreground font-mono text-xs">
                understanding 14 interactions…
              </p>
            </div>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <footer className="mt-16 border-t pt-8">
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <Logo markOnly className="text-muted-foreground" />
            <span className="font-mono">tacto · captured by hand, written by machine</span>
          </div>
        </footer>
      </main>
    </div>
  )
}

function SectionHeading({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`border-b pb-3 ${className}`}>
      <h2 className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
        {children}
      </h2>
    </div>
  )
}

function RoleLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground font-mono text-[10px] tracking-widest uppercase">
      {children}
    </p>
  )
}
