"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  Eye,
  MousePointerClick,
  MessageSquare,
  Download,
  Send,
} from "lucide-react"

import { TRANSLATION_LANGUAGES } from "@workspace/contracts/guide"
import type { AnalyticsRange, GuideAnalytics } from "@workspace/contracts/guide-analytics"
import { Button } from "@workspace/ui/components/button"

import { TrendChart } from "@/components/analytics/trend-chart"
import {
  BarRow,
  formatCompact,
  formatMs,
  Panel,
  RangeToggle,
  StatCard,
  StatGrid,
} from "@/components/analytics/ui"
import { useSetNavbar } from "@/components/navbar-context"
import { authClient } from "@/lib/auth-client"
import { useGuide, useGuideAnalytics } from "@/lib/guides"
import { cn } from "@workspace/ui/lib/utils"

const RANGES = ["7d", "30d", "90d"] as const

const LANG_NAME = new Map<string, string>(
  TRANSLATION_LANGUAGES.map((l) => [l.code, l.name])
)

export default function GuideAnalyticsPage() {
  const params = useParams<{ id: string }>()
  const { data: activeWorkspace } = authClient.useActiveOrganization()
  const { data: guide } = useGuide(activeWorkspace?.id, params.id)
  const [range, setRange] = React.useState<AnalyticsRange>("30d")
  const { data, isPending } = useGuideAnalytics(params.id, range)

  useSetNavbar(
    {
      leftActions: (
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={`/guides/${params.id}`} />}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <h1 className="truncate text-[15px] font-semibold">Analytics</h1>
        </div>
      ),
    },
    [params.id]
  )

  const unpublished = guide != null && guide.status !== "PUBLISHED"

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-tight">
            {guide?.title ?? "Guide"}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Reader engagement · last {range === "7d" ? "7 days" : range === "30d" ? "30 days" : "90 days"}
          </p>
        </div>
        <RangeToggle value={range} options={RANGES} onChange={setRange} />
      </div>

      {unpublished ? (
        <EmptyState
          title="Publish this guide to collect analytics"
          body="Analytics track how readers engage with your published guide. Publish it, then share the link."
        />
      ) : isPending || !data ? (
        <AnalyticsSkeleton />
      ) : data.totals.views === 0 ? (
        <EmptyState
          title="No reads yet"
          body="Share your guide's link — views, completion, and engagement will show up here as people read it."
        />
      ) : (
        <AnalyticsContent data={data} />
      )}
    </div>
  )
}

function AnalyticsContent({ data }: { data: GuideAnalytics }) {
  const [metric, setMetric] = React.useState<"views" | "completions">("views")
  const t = data.totals

  return (
    <div className="flex flex-col gap-5">
      {/* Overview */}
      <StatGrid>
        <StatCard label="Views" value={formatCompact(t.views)} hint={`${data.lifetimeViews.toLocaleString()} all-time`} />
        <StatCard label="Unique viewers" value={formatCompact(t.uniqueViewers)} />
        <StatCard label="Avg. time" value={formatMs(t.avgTimeMs)} />
        <StatCard label="Completion" value={`${t.completionRate}%`} />
        <StatCard label="Engagement" value={`${t.engagementRate}%`} />
      </StatGrid>

      {/* Trend */}
      <Panel
        title="Views over time"
        action={
          <div className="flex gap-1">
            {(["views", "completions"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium capitalize transition-colors",
                  metric === m
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        }
      >
        <TrendChart
          data={data.trend.map((d) => ({ date: d.date, count: d[metric] }))}
          ariaLabel={`${metric} over time`}
        />
      </Panel>

      {/* Funnel + drop-off */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Read funnel">
          <div className="flex flex-col gap-2.5">
            <FunnelRow label="Viewed" value={data.funnel.viewed} total={data.funnel.viewed} />
            <FunnelRow label="Engaged" value={data.funnel.engaged} total={data.funnel.viewed} />
            <FunnelRow label="Started walkthrough" value={data.funnel.started} total={data.funnel.viewed} />
            <FunnelRow label="Completed" value={data.funnel.completed} total={data.funnel.viewed} />
          </div>
        </Panel>

        {data.stepDropoff.length > 0 ? (
          <Panel title="Walkthrough drop-off">
            <div className="flex flex-col gap-2">
              {data.stepDropoff.map((s) => (
                <BarRow
                  key={s.step}
                  label={`Step ${s.step + 1}`}
                  value={s.sessions}
                  max={data.stepDropoff[0]?.sessions ?? 1}
                  labelWidth="w-20"
                />
              ))}
            </div>
          </Panel>
        ) : (
          <Panel title="Walkthrough drop-off">
            <p className="py-6 text-center text-sm text-muted-foreground">
              No walkthrough reads in this range.
            </p>
          </Panel>
        )}
      </div>

      {/* Engagement */}
      <Panel title="Engagement">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat icon={<MousePointerClick className="size-3.5" />} label="Reactions" value={data.engagement.reactions} />
          <MiniStat icon={<MessageSquare className="size-3.5" />} label="Comments" value={data.engagement.comments} />
          <MiniStat icon={<Download className="size-3.5" />} label="PDF downloads" value={data.engagement.pdfDownloads} />
          <MiniStat icon={<Send className="size-3.5" />} label="Form submits" value={data.engagement.formSubmits} />
        </div>
        {data.engagement.reactionsByEmoji.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
            {data.engagement.reactionsByEmoji.map((r) => (
              <span
                key={r.emoji}
                className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs tabular-nums"
              >
                <span>{r.emoji}</span>
                {r.count}
              </span>
            ))}
          </div>
        )}
      </Panel>

      {/* Breakdown: languages / sources / mode */}
      <div className="grid gap-5 lg:grid-cols-3">
        <ShareList
          title="Top languages"
          items={data.languages.map((l) => ({
            label: LANG_NAME.get(l.language) ?? l.language,
            value: l.sessions,
          }))}
          empty="Only the original language was read."
        />
        <ShareList
          title="Traffic sources"
          items={data.sources.map((s) => ({
            label: s.host === "direct" ? "Direct" : s.host,
            value: s.views,
          }))}
          empty="No source data yet."
        />
        <Panel title="How they read">
          {data.modes.list + data.modes.interactive === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No mode data yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <BarRow
                label="Scroll"
                value={data.modes.list}
                max={Math.max(data.modes.list, data.modes.interactive, 1)}
                labelWidth="w-24"
                suffix=" sessions"
              />
              <BarRow
                label="Walkthrough"
                value={data.modes.interactive}
                max={Math.max(data.modes.list, data.modes.interactive, 1)}
                labelWidth="w-24"
                suffix=" sessions"
              />
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}

/** A funnel bar with a "% of viewed" caption. */
function FunnelRow({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {value.toLocaleString()} <span className="text-xs">· {pct}%</span>
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ShareList({
  title,
  items,
  empty,
}: {
  title: string
  items: { label: string; value: number }[]
  empty: string
}) {
  const max = items[0]?.value ?? 1
  return (
    <Panel title={title}>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((it) => (
            <BarRow key={it.label} label={it.label} value={it.value} max={max} labelWidth="w-24" />
          ))}
        </div>
      )}
    </Panel>
  )
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value.toLocaleString()}</p>
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center">
      <Eye className="size-6 text-muted-foreground" />
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl border bg-muted/40" />
        ))}
      </div>
      <div className="h-56 animate-pulse rounded-xl border bg-muted/40" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-40 animate-pulse rounded-xl border bg-muted/40" />
        <div className="h-40 animate-pulse rounded-xl border bg-muted/40" />
      </div>
    </div>
  )
}
