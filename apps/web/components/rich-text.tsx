import { cn } from "@workspace/ui/lib/utils"

/**
 * Read-only render of a block's sanitized HTML content. The API sanitizes
 * on write (and public reads), so dangerouslySetInnerHTML is safe here.
 *
 * Body text is SANS (comfortable for reading step-by-step); only headings
 * inside content stay serif for editorial character. This is the single
 * source of truth for how guide content reads.
 */
export function RichText({
  html,
  className,
}: {
  html: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "font-sans leading-relaxed",
        "[&_a]:text-viridian [&_a]:decoration-viridian/40 [&_a]:underline [&_a]:underline-offset-2",
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        "[&_h1]:mt-0 [&_h1]:font-serif [&_h1]:text-2xl [&_h1]:font-medium [&_h1]:tracking-tight",
        "[&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-medium [&_h2]:tracking-tight",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5",
        "[&_p]:my-0",
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
