"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Skeleton } from "@workspace/ui/components/skeleton"

import { authClient } from "@/lib/auth-client"

/**
 * Root — route by session: signed in → /home, otherwise → /sign-in.
 * Becomes the marketing page at launch.
 */
export default function RootPage() {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()

  React.useEffect(() => {
    if (isPending) return
    router.replace(session ? "/home" : "/sign-in")
  }, [isPending, session, router])

  return (
    <div className="mx-auto max-w-4xl px-6 pt-20">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-6 h-4 w-full" />
      <Skeleton className="mt-3 h-4 w-2/3" />
    </div>
  )
}
