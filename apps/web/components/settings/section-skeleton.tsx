/** Shared loading skeleton for a settings section while auth/session data loads. */
export function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="space-y-2 py-2">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="h-3.5 w-64 animate-pulse rounded bg-muted/70" />
      </div>
      <div className="mt-6 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-6 py-2">
            <div className="space-y-1.5">
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
              <div className="h-3 w-48 animate-pulse rounded bg-muted/60" />
            </div>
            <div className="h-8 w-24 animate-pulse rounded-lg bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
