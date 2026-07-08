"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { StepMarker } from "@workspace/ui/components/step-marker"

import { authClient } from "@/lib/auth-client"
import { formatDate, renderInstruction } from "@/lib/format"
import { useGuide } from "@/lib/guides"

/**
 * Guide view — read-only for now (the editor is a later phase).
 * The knowledge is the object: serif instructions, mono machine metadata.
 */
export default function GuidePage() {
  const params = useParams<{ id: string }>()
  const { data: activeWorkspace } = authClient.useActiveOrganization()
  const { data: guide, isPending, isError } = useGuide(
    activeWorkspace?.id,
    params.id
  )

  if (isPending) {
    return (
      <div className="mx-auto max-w-2xl">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-6 h-10 w-3/4" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-12 h-24 w-full" />
        <Skeleton className="mt-6 h-24 w-full" />
      </div>
    )
  }

  if (isError || !guide) {
    return (
      <div className="mx-auto max-w-2xl pt-20 text-center">
        <p className="font-serif text-2xl">This guide doesn&apos;t exist.</p>
        <p className="text-muted-foreground mt-2 text-sm">
          It may have been deleted, or it belongs to another workspace.
        </p>
        <Link
          href="/home"
          className="text-viridian mt-6 inline-block text-sm hover:underline"
        >
          Back to home
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/home"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        Home
      </Link>

      <div className="mt-8 flex items-start justify-between gap-4">
        <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance">
          {guide.title}
        </h1>
        <Badge variant="secondary" className="mt-2 shrink-0 font-mono text-[10px]">
          {guide.status.toLowerCase()}
        </Badge>
      </div>
      {guide.summary && (
        <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
          {guide.summary}
        </p>
      )}
      <p className="text-muted-foreground mt-4 border-b pb-6 font-mono text-xs">
        {guide.steps.length} steps · captured {formatDate(guide.createdAt)}
      </p>

      <ol className="mt-10 flex flex-col gap-10">
        {guide.steps.map((step) => (
          <li key={step.id} className="flex gap-5">
            <StepMarker step={step.position} size="lg" className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="font-serif text-xl leading-relaxed">
                {renderInstruction(step.instruction)}
              </p>
              {step.url && (
                <p className="text-muted-foreground mt-1.5 truncate font-mono text-xs">
                  {step.url.replace(/^https?:\/\//, "")}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="text-muted-foreground mt-16 border-t pt-6 font-mono text-xs">
        captured by hand · written by machine
      </div>
    </div>
  )
}
