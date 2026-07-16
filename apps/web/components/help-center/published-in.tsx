"use client"

import Link from "next/link"
import { ArrowUpRight, LifeBuoy, Star } from "lucide-react"

import { useGuidePlacement } from "@/lib/help-center"

/**
 * A small, read-only "Published In" section for the guide editor — shows which
 * help-center collections a guide appears in (and whether it's featured), with
 * a link into the Help Center. Never an editor; managing placement happens in
 * the Help Center builder. Renders nothing when the guide isn't in the help
 * center.
 */
export function PublishedIn({ guideId }: { guideId: string }) {
  const { data: placement } = useGuidePlacement(guideId)
  if (!placement) return null

  return (
    <div className="mx-auto mb-6 flex max-w-2xl flex-wrap items-center gap-2 rounded-xl border border-[var(--l-hairline)] bg-[var(--l-card)] px-4 py-2.5">
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
        <LifeBuoy className="size-3.5" />
        Published in
      </span>
      {placement.collections.map((c) => (
        <span
          key={c.id}
          className="inline-flex items-center rounded-md bg-[var(--l-lift)] px-2 py-0.5 text-[12px] font-medium text-[var(--l-ink-subtle)] ring-1 ring-inset ring-[var(--l-hairline)]"
        >
          {c.name}
        </span>
      ))}
      {placement.featured && (
        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[12px] font-medium text-primary ring-1 ring-inset ring-primary/25">
          <Star className="size-3 fill-current" />
          Featured
        </span>
      )}
      <Link
        href="/help-center"
        className="ml-auto inline-flex items-center gap-0.5 text-[12px] font-semibold text-primary hover:underline"
      >
        Open Help Center
        <ArrowUpRight className="size-3.5" />
      </Link>
    </div>
  )
}
