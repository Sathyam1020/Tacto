"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { ExternalLink, Loader2 } from "lucide-react"

import { videoEmbed, type ShowcaseItemPayload } from "@workspace/contracts/showcase"

import { PublicGuideView } from "@/components/public-guide-view"
import type { PublicGuide } from "@/lib/public-guide"

/**
 * Renders one showcase item by type. Guides use the Guide Reader (fetched
 * lazily, chromeless, attributed to the showcase); resources use their own
 * lightweight renderers. `onComplete` fires when the item finishes (guide
 * completion / video ended) so the parent can advance in autoplay.
 */
export function ShowcaseItemView({
  item,
  slug,
  onComplete,
}: {
  item: ShowcaseItemPayload
  slug: string
  onComplete?: () => void
}) {
  switch (item.type) {
    case "guide":
      return item.guideShareId ? (
        <GuideItem shareId={item.guideShareId} slug={slug} onComplete={onComplete} />
      ) : null
    case "video":
      return <VideoItem url={item.url} title={item.title} onComplete={onComplete} />
    case "pdf":
      return (
        <iframe
          src={item.url ?? ""}
          title={item.title}
          className="h-[78vh] w-full rounded-xl border border-[var(--l-hairline)]"
        />
      )
    case "form":
      return (
        <iframe
          src={item.formShareId ? `/f/${item.formShareId}` : ""}
          title={item.title}
          className="h-[78vh] w-full rounded-xl border border-[var(--l-hairline)]"
        />
      )
    case "link":
      return <LinkItem url={item.url} title={item.title} />
    default:
      return null
  }
}

function GuideItem({ shareId, slug, onComplete }: { shareId: string; slug: string; onComplete?: () => void }) {
  const { data: guide, isPending } = useQuery({
    queryKey: ["public-guide", shareId],
    queryFn: async () => {
      const res = await fetch(`/api/public/guides/${shareId}`, { cache: "no-store" })
      if (!res.ok) throw new Error("not found")
      return ((await res.json()) as { guide: PublicGuide }).guide
    },
  })

  // Advance on completion (the reader dispatches `tacto:track` with type "complete").
  React.useEffect(() => {
    if (!onComplete) return
    const onTrack = (e: Event) => {
      if ((e as CustomEvent).detail?.type === "complete") onComplete()
    }
    window.addEventListener("tacto:track", onTrack as EventListener)
    return () => window.removeEventListener("tacto:track", onTrack as EventListener)
  }, [onComplete])

  if (isPending) return <ItemSpinner />
  if (!guide) return <ItemError message="This guide is unavailable." />
  return <PublicGuideView guide={guide} chromeless stepVariant="cards" source={`showcase:${slug}`} />
}

function VideoItem({ url, title, onComplete }: { url: string | null; title: string; onComplete?: () => void }) {
  if (!url) return <ItemError message="Missing video." />
  const { provider, embedUrl } = videoEmbed(url)
  if (provider === "mp4") {
    return (
      <video
        src={url}
        controls
        onEnded={onComplete}
        className="aspect-video w-full rounded-xl border border-[var(--l-hairline)] bg-black"
      />
    )
  }
  if (!embedUrl) return <ItemError message="Unsupported video URL." />
  return (
    <iframe
      src={embedUrl}
      title={title}
      allow="fullscreen; picture-in-picture"
      allowFullScreen
      className="aspect-video w-full rounded-xl border border-[var(--l-hairline)]"
    />
  )
}

function LinkItem({ url, title }: { url: string | null; title: string }) {
  if (!url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-xl border border-[var(--l-hairline)] bg-[var(--l-card)] p-5 transition-colors hover:border-primary/40"
    >
      <span className="flex size-10 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
        <ExternalLink className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="block truncate text-[13px] text-[var(--l-ink-subtle)]">{url}</span>
      </span>
      <ExternalLink className="size-4 flex-none text-[var(--l-ink-tertiary)] transition-transform group-hover:translate-x-0.5" />
    </a>
  )
}

function ItemSpinner() {
  return (
    <div className="flex h-64 items-center justify-center text-[var(--l-ink-tertiary)]">
      <Loader2 className="size-6 animate-spin" />
    </div>
  )
}
function ItemError({ message }: { message: string }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-[var(--l-hairline-strong)] text-sm text-[var(--l-ink-subtle)]">
      {message}
    </div>
  )
}
