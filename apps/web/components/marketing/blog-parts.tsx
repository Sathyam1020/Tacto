import Link from "next/link"
import {
  ArrowRight,
  BookOpen,
  FileText,
  GraduationCap,
  Megaphone,
  ScrollText,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

import { formatDate, type BlogPost } from "@/lib/marketing/blog"

const TAG_ICON: Record<string, LucideIcon> = {
  "Process Documentation": FileText,
  Tools: Wrench,
  "SOPs & Documentation": ScrollText,
  "Team Productivity": Users,
  "Product Marketing": Megaphone,
  "Customer Onboarding": GraduationCap,
}

function iconFor(tags: string[]): LucideIcon {
  for (const t of tags) if (TAG_ICON[t]) return TAG_ICON[t]!
  return BookOpen
}

/** A designed, on-brand gradient cover keyed to the post's primary topic — no
 *  stock photography, no gray boxes. */
export function BlogCover({ post, className }: { post: BlogPost; className?: string }) {
  const Icon = iconFor(post.tags)
  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary/16 via-primary/6 to-transparent", className)}>
      <div
        aria-hidden
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: "radial-gradient(var(--cobalt) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(70% 100% at 50% 0%, #000, transparent)",
        }}
      />
      <Icon aria-hidden className="absolute -right-5 -bottom-6 size-40 text-cobalt/10" strokeWidth={1.1} />
      <span className="relative flex size-14 items-center justify-center rounded-2xl bg-white text-cobalt shadow-md">
        <Icon className="size-7" />
      </span>
    </div>
  )
}

export function TagChip({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--l-hairline)] bg-white px-2.5 py-0.5 text-[11.5px] font-medium text-[var(--l-ink-subtle)]">
      {tag}
    </span>
  )
}

function Meta({ post }: { post: BlogPost }) {
  return (
    <p className="font-mono text-[11.5px] tracking-wide text-[var(--l-ink-tertiary)]">
      {formatDate(post.date)} · {post.readingMinutes} min read
    </p>
  )
}

/** Large featured card — cover on top, used in the index's featured row. */
export function FeaturedCard({ post }: { post: BlogPost }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-[var(--l-hairline)] bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_60px_-30px_rgba(20,23,40,0.35)]"
    >
      <BlogCover post={post} className="h-44" />
      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap gap-1.5">
          {post.tags.slice(0, 2).map((t) => (
            <TagChip key={t} tag={t} />
          ))}
        </div>
        <h3 className="mt-3 font-display text-[19px] leading-snug font-semibold tracking-tight text-[var(--l-ink)]">
          {post.title}
        </h3>
        <p className="mt-2 line-clamp-3 flex-1 text-[14px] leading-relaxed text-[var(--l-ink-subtle)]">
          {post.description}
        </p>
        <div className="mt-5">
          <Meta post={post} />
        </div>
      </div>
    </Link>
  )
}

/** Horizontal list row — cover left, text right. */
export function PostRow({ post }: { post: BlogPost }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group grid gap-5 rounded-3xl border border-[var(--l-hairline)] bg-white p-4 transition-all duration-300 hover:shadow-[0_20px_50px_-30px_rgba(20,23,40,0.3)] sm:grid-cols-[220px_1fr] sm:p-5"
    >
      <BlogCover post={post} className="h-40 rounded-2xl sm:h-full" />
      <div className="flex flex-col py-1">
        <div className="flex flex-wrap gap-1.5">
          {post.tags.map((t) => (
            <TagChip key={t} tag={t} />
          ))}
        </div>
        <h3 className="mt-3 font-display text-[21px] leading-snug font-semibold tracking-tight text-[var(--l-ink)]">
          {post.title}
        </h3>
        <p className="mt-2 flex-1 text-[14.5px] leading-relaxed text-[var(--l-ink-subtle)]">{post.description}</p>
        <div className="mt-4 flex items-center justify-between">
          <Meta post={post} />
          <span className="inline-flex items-center gap-1 text-[13px] font-medium text-cobalt">
            Read <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </Link>
  )
}
