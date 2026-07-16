/** Light, brand-neutral skeleton shown while a help-center page streams in.
 *  Kept minimal (a header bar + hero + card grid) so first paint is instant and
 *  matches the eventual layout without a dark flash. */
export default function HelpLoading() {
  return (
    <div className="flex min-h-svh flex-col" style={{ backgroundColor: "#FEFFFF" }}>
      <div className="h-16 bg-[var(--l-chrome)]" />
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-center gap-4 py-14">
          <div className="h-8 w-64 animate-pulse rounded-lg bg-[var(--l-hairline-strong)]" />
          <div className="h-4 w-80 animate-pulse rounded bg-[var(--l-chrome)]" />
          <div className="mt-4 h-14 w-full max-w-xl animate-pulse rounded-2xl bg-[var(--l-chrome)]" />
        </div>
        <div className="grid grid-cols-1 gap-4 pb-16 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-card)]"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
