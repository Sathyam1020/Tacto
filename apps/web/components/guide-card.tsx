"use client"

import Link from "next/link"

import { cn } from "@workspace/ui/lib/utils"

import { formatDate } from "@/lib/format"
import type { GuideListItem } from "@/lib/guides"

/**
 * Guide card — tinted cover with the serif title, quiet footer with the
 * machine metadata. Once captures carry screenshots, the cover becomes the
 * first step's image; the tint stays as fallback.
 *
 * Cover tints are deterministic per guide (stable across reloads) and drawn
 * from the brand palette.
 */

const COVER_TINTS = [
  "bg-ink text-paper dark:bg-paper dark:text-ink", // ink
  "bg-viridian text-white", // viridian
  "bg-[#4A6FA5] text-white", // slate
  "bg-[#B98A2E] text-white", // amber
] as const

function coverTint(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0
  }
  return COVER_TINTS[Math.abs(hash) % COVER_TINTS.length]!
}

export function GuideCard({ guide }: { guide: GuideListItem }) {
  return (
    <Link
      href={`/guides/${guide.id}`}
      className="group bg-card focus-visible:ring-ring/50 block overflow-hidden rounded-xl border outline-none transition-shadow focus-visible:ring-3"
    >
      <div
        className={cn(
          "flex aspect-[16/9] items-center justify-center p-6",
          coverTint(guide.id)
        )}
      >
        <span className="line-clamp-3 text-center font-serif text-xl leading-snug text-balance">
          {guide.title}
        </span>
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-muted-foreground font-mono text-xs">
          {guide.stepCount} steps · {formatDate(guide.createdAt)}
        </span>
        <span className="text-muted-foreground group-hover:text-viridian text-xs transition-colors">
          Open →
        </span>
      </div>
    </Link>
  )
}
