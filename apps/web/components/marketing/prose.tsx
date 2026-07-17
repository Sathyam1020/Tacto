import type * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Long-form typographic wrapper for authored content (blog posts, legal pages,
 * docs). Styles plain semantic children — h2/h3, p, ul/ol, a, strong,
 * blockquote — via child selectors, so authors write clean JSX with no per-
 * element classes and no typography plugin dependency.
 */
export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "max-w-none",
        "[&>h2]:mt-12 [&>h2]:mb-0 [&>h2]:font-display [&>h2]:text-[26px] [&>h2]:font-semibold [&>h2]:tracking-[-0.01em] [&>h2]:text-[var(--l-ink)]",
        "[&>h3]:mt-9 [&>h3]:font-display [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:text-[var(--l-ink)]",
        "[&>p]:mt-5 [&>p]:text-[16.5px] [&>p]:leading-[1.75] [&>p]:text-[var(--l-ink-subtle)]",
        "[&>ul]:mt-5 [&>ul]:list-disc [&>ul]:space-y-2 [&>ul]:pl-5 [&>ul]:marker:text-cobalt/60",
        "[&>ol]:mt-5 [&>ol]:list-decimal [&>ol]:space-y-2 [&>ol]:pl-5 [&>ol]:marker:text-[var(--l-ink-tertiary)]",
        "[&_li]:text-[16px] [&_li]:leading-relaxed [&_li]:text-[var(--l-ink-subtle)] [&_li]:pl-1",
        "[&_a]:font-medium [&_a]:text-cobalt [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary",
        "[&_strong]:font-semibold [&_strong]:text-[var(--l-ink)]",
        "[&>blockquote]:mt-7 [&>blockquote]:border-l-2 [&>blockquote]:border-primary [&>blockquote]:pl-5 [&>blockquote]:font-accent [&>blockquote]:text-[22px] [&>blockquote]:leading-snug [&>blockquote]:text-[var(--l-ink)]",
        "[&>hr]:my-10 [&>hr]:border-[var(--l-hairline)]",
        className
      )}
    >
      {children}
    </div>
  )
}
