"use client"

import * as React from "react"
import { BarChart3 } from "lucide-react"

import {
  SHOWCASE_ANALYTICS_RANGES,
  type ShowcaseAnalyticsRange,
  type ShowcaseDetail,
} from "@workspace/contracts/showcase"

import { TrendChart } from "@/components/analytics/trend-chart"
import { BarRow, formatCompact, Panel, RangeToggle, StatCard, StatGrid } from "@/components/analytics/ui"
import { useShowcaseAnalytics } from "@/lib/showcase"

/** The showcase editor's Analytics tab — engagement roll-up over a range.
 *  Reuses the shared analytics primitives (one visual language across Forms,
 *  Guides, Help Center). Per-guide reads are on each guide's own analytics
 *  (tagged source="showcase:{slug}"); this is showcase-level engagement. */
export function AnalyticsSurface({ sc }: { sc: ShowcaseDetail }) {
  const [range, setRange] = React.useState<ShowcaseAnalyticsRange>("30d")
  const { data, isPending } = useShowcaseAnalytics(sc.id, range)
  const published = sc.status === "PUBLISHED"

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Analytics</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Showcase engagement · last {range === "7d" ? "7 days" : range === "30d" ? "30 days" : "90 days"}
          </p>
        </div>
        <RangeToggle value={range} options={SHOWCASE_ANALYTICS_RANGES} onChange={setRange} />
      </div>

      {!published ? (
        <EmptyState
          title="Publish to collect analytics"
          body="Analytics track how visitors engage with your live showcase. Publish it, then share the link or embed."
        />
      ) : isPending || !data ? (
        <AnalyticsSkeleton />
      ) : data.totals.views === 0 ? (
        <EmptyState
          title="No visits yet"
          body="Share your showcase link or embed it — views, item opens, and completion will show up here."
        />
      ) : (
        <div className="flex flex-col gap-5">
          <StatGrid>
            <StatCard label="Views" value={formatCompact(data.totals.views)} />
            <StatCard label="Unique visitors" value={formatCompact(data.totals.uniqueVisitors)} />
            <StatCard label="Item opens" value={formatCompact(data.totals.itemOpens)} />
            <StatCard label="Completion" value={`${data.totals.completionRate}%`} />
          </StatGrid>

          <Panel title="Views over time">
            <TrendChart
              data={data.trend.map((d) => ({ date: d.date, count: d.views }))}
              ariaLabel="Showcase views over time"
            />
          </Panel>

          <Panel title="Item engagement">
            {data.topItems.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No item opens in this range yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {data.topItems.map((it) => (
                  <BarRow
                    key={it.itemId}
                    label={it.title}
                    value={it.opens}
                    max={data.topItems[0]?.opens ?? 1}
                    suffix={it.completes > 0 ? ` · ${it.completes} done` : ""}
                    labelWidth="w-44"
                  />
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center">
      <BarChart3 className="size-6 text-muted-foreground" />
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl border bg-muted/40" />
        ))}
      </div>
      <div className="h-56 animate-pulse rounded-xl border bg-muted/40" />
      <div className="h-40 animate-pulse rounded-xl border bg-muted/40" />
    </div>
  )
}
