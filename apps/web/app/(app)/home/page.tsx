"use client"

import { RotateCcw, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { TouchRing } from "@workspace/ui/components/touch-ring"

import { GuideCard } from "@/components/guide-card"
import { authClient } from "@/lib/auth-client"
import {
  useActiveCaptures,
  useDismissCapture,
  useGuides,
  useRetryCapture,
  type ActiveCapture,
} from "@/lib/guides"

/** Pull the API's human-readable error message, if any. */
function apiMessage(error: unknown): string | undefined {
  const e = error as { response?: { data?: { error?: { message?: string } } } }
  return e.response?.data?.error?.message
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 5) return "Working late"
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

/**
 * A capture still being uploaded/processed, or one that failed. Failed cards
 * offer Retry (when the source data survives) and Dismiss; in-flight cards get
 * a hover × to cancel a stuck one — so no capture is ever a dead-end.
 */
function CaptureCard({
  capture,
  workspaceId,
}: {
  capture: ActiveCapture
  workspaceId: string | undefined
}) {
  const failed = capture.status === "FAILED"
  const retry = useRetryCapture(workspaceId)
  const dismiss = useDismissCapture(workspaceId)
  const busy = retry.isPending || dismiss.isPending

  function onRetry() {
    retry.mutate(capture.id, {
      onSuccess: () => toast.success("Retrying capture…"),
      onError: (error) =>
        toast.error(apiMessage(error) ?? "Couldn't retry this capture"),
    })
  }

  function onDismiss() {
    dismiss.mutate(capture.id, {
      onSuccess: () => toast.success("Capture dismissed"),
      onError: () => toast.error("Couldn't dismiss this capture"),
    })
  }

  return (
    <div className="group bg-card relative overflow-hidden rounded-xl border">
      {/* In-flight cancel: the only escape hatch for a stuck upload/processing. */}
      {!failed && (
        <button
          aria-label="Cancel capture"
          onClick={onDismiss}
          disabled={busy}
          className="bg-card/80 text-muted-foreground hover:text-foreground absolute top-2 right-2 z-10 flex size-7 items-center justify-center rounded-lg opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-50"
        >
          <X className="size-4" />
        </button>
      )}

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

      <div className="flex items-center justify-between gap-3 px-4 py-3">
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

        {failed && (
          <div className="flex shrink-0 items-center gap-1.5">
            {capture.retryable && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                disabled={busy}
              >
                <RotateCcw className="size-3.5" />
                Retry
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
              disabled={busy}
            >
              Dismiss
            </Button>
          </div>
        )}
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
              <CaptureCard
                key={capture.id}
                capture={capture}
                workspaceId={activeWorkspace?.id}
              />
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
