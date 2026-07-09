"use client"

import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { TouchRing } from "@workspace/ui/components/touch-ring"

import { GuideCard } from "@/components/guide-card"
import { authClient } from "@/lib/auth-client"
import {
  useActiveCaptures,
  useGuides,
  type ActiveCapture,
} from "@/lib/guides"

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 5) return "Working late"
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

/** A capture still being uploaded/processed (or failed) — card placeholder. */
function CaptureCard({ capture }: { capture: ActiveCapture }) {
  const failed = capture.status === "FAILED"
  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      <div className="bg-muted flex aspect-[16/9] flex-col items-center justify-center gap-3 p-6">
        <TouchRing
          variant={failed ? "static" : "processing"}
          tone={failed ? "recording" : "touch"}
          size="lg"
          label={failed ? "Processing failed" : "Processing"}
        />
        <span className="text-muted-foreground text-center font-serif text-lg">
          {capture.title || "Untitled capture"}
        </span>
      </div>
      <div className="px-4 py-3">
        <span
          className={
            failed
              ? "text-signal text-xs"
              : "text-muted-foreground font-mono text-xs"
          }
        >
          {failed
            ? (capture.errorMessage ?? "Processing failed")
            : capture.status === "UPLOADING"
              ? "waiting for upload…"
              : "writing your guide…"}
        </span>
      </div>
    </div>
  )
}

/** Home — greeting + every guide in the workspace, as covers. */
export default function HomePage() {
  const { data: session } = authClient.useSession()
  const { data: activeWorkspace } = authClient.useActiveOrganization()
  const { data: guides, isPending } = useGuides(activeWorkspace?.id)
  const { data: activeCaptures } = useActiveCaptures(activeWorkspace?.id)
  const firstName = session?.user.name.trim().split(/\s+/)[0]
  const inFlight = activeCaptures ?? []

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
        {new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </p>
      <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight text-balance">
        {greeting()}
        {firstName ? `, ${firstName}` : ""}.
      </h1>

      <section className="mt-14">
        <div className="flex items-baseline justify-between border-b pb-3">
          <h2 className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
            Guides
          </h2>
          <span className="text-muted-foreground font-mono text-xs">
            {guides
              ? `${guides.length} guide${guides.length === 1 ? "" : "s"}`
              : "…"}
          </span>
        </div>

        {isPending && (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="aspect-[16/9] rounded-xl" />
            <Skeleton className="aspect-[16/9] rounded-xl" />
            <Skeleton className="aspect-[16/9] rounded-xl" />
          </div>
        )}

        {guides && guides.length === 0 && inFlight.length === 0 && (
          <div className="flex flex-col items-center py-24 text-center">
            <TouchRing size="xl" />
            <h3 className="mt-8 font-serif text-3xl font-medium tracking-tight">
              Nothing captured yet.
            </h3>
            <p className="text-muted-foreground mt-3 max-w-sm text-sm leading-relaxed">
              Your first guide starts with a capture. Record a workflow once —
              Tacto writes the documentation.
            </p>
            <Button size="lg" className="mt-8" disabled>
              <TouchRing size="sm" tone="neutral" />
              Capture — coming soon
            </Button>
          </div>
        )}

        {(inFlight.length > 0 || (guides && guides.length > 0)) && (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {inFlight.map((capture) => (
              <CaptureCard key={capture.id} capture={capture} />
            ))}
            {guides?.map((guide) => (
              <GuideCard key={guide.id} guide={guide} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
