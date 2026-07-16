"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { Eye } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

import { ContentSurface, DesignSurface, SettingsSurface } from "@/components/showcase/builder"
import { useSetNavbar } from "@/components/navbar-context"
import { usePublishShowcase, useShowcase } from "@/lib/showcase"

type Tab = "content" | "design" | "settings"
const TABS: { value: Tab; label: string }[] = [
  { value: "content", label: "Content" },
  { value: "design", label: "Design" },
  { value: "settings", label: "Settings" },
]

export default function ShowcaseEditorPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { data: sc } = useShowcase(params.id)
  const publish = usePublishShowcase(params.id)
  const [tab, setTab] = React.useState<Tab>("content")

  const published = sc?.status === "PUBLISHED"

  useSetNavbar(
    {
      leftActions: (
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-[15px] font-semibold">{sc?.title ?? "Showcase"}</h1>
          {sc && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
                published
                  ? "bg-[var(--l-success)]/10 text-[var(--l-success)] ring-[var(--l-success-ring)]"
                  : "bg-[var(--l-chrome)] text-muted-foreground ring-[var(--l-hairline)]"
              )}
            >
              {published && <span className="size-1.5 rounded-full bg-[var(--l-success)]" />}
              {published ? "Live" : "Draft"}
            </span>
          )}
        </div>
      ),
      actions: (
        <div className="flex items-center gap-2">
          {sc?.slug && (
            <Button variant="outline" size="sm" render={<a href={`/showcase/${sc.slug}`} target="_blank" rel="noreferrer" />}>
              <Eye className="size-4" />
              {published ? "View" : "Preview"}
            </Button>
          )}
          {sc && !published && (
            <Button size="sm" disabled={publish.isPending} onClick={() => publish.mutate(true)}>
              {publish.isPending ? "Publishing…" : "Publish"}
            </Button>
          )}
        </div>
      ),
    },
    [sc?.title, sc?.slug, published, publish.isPending]
  )

  if (!sc) {
    return (
      <div className="mx-auto max-w-3xl">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-6 h-40 w-full" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 inline-flex rounded-lg bg-muted p-0.5">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "rounded-md px-4 py-1.5 text-[13px] font-medium transition-colors",
              tab === t.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "content" ? (
        <ContentSurface sc={sc} />
      ) : tab === "design" ? (
        <DesignSurface sc={sc} />
      ) : (
        <SettingsSurface sc={sc} onDeleted={() => router.push("/showcases")} />
      )}
    </div>
  )
}
