"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import { LogoMark } from "@workspace/ui/components/logo"

import { authClient } from "@/lib/auth-client"

type Invitation = {
  organizationName?: string
  organizationId?: string
  role?: string
  email?: string
  status?: string
}

/**
 * Link-based invite acceptance. Lives OUTSIDE the (app) group so a brand-new
 * invitee isn't blocked by the extension-onboarding gate. Unauthenticated users
 * are sent to sign-in with a `next` back to here.
 */
export default function InvitePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: session, isPending: sessionPending } = authClient.useSession()

  const [inv, setInv] = React.useState<Invitation | null | undefined>(undefined)
  const [accepting, setAccepting] = React.useState(false)

  React.useEffect(() => {
    if (!sessionPending && !session) {
      router.replace(`/sign-in?next=/invite/${id}`)
    }
  }, [sessionPending, session, id, router])

  React.useEffect(() => {
    if (!session || !id) return
    let cancelled = false
    void authClient.organization.getInvitation({ query: { id } }).then(({ data, error }) => {
      if (!cancelled) setInv(error ? null : (data as Invitation))
    })
    return () => {
      cancelled = true
    }
  }, [session, id])

  async function accept() {
    setAccepting(true)
    const { data, error } = await authClient.organization.acceptInvitation({ invitationId: id })
    if (error) {
      toast.error(error.message ?? "Couldn't accept the invitation")
      setAccepting(false)
      return
    }
    const orgId =
      (data as { invitation?: { organizationId?: string } } | null)?.invitation?.organizationId ??
      inv?.organizationId
    if (orgId) await authClient.organization.setActive({ organizationId: orgId })
    toast.success("Welcome to the team")
    router.push("/home")
  }

  async function decline() {
    await authClient.organization.rejectInvitation({ invitationId: id })
    router.push("/home")
  }

  const loading = sessionPending || (!!session && inv === undefined)

  return (
    <div className="flex min-h-svh items-center justify-center bg-[var(--l-canvas)] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-content-a)] p-8 text-center shadow-sm">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <LogoMark className="size-6" />
        </span>

        {loading ? (
          <div className="mt-6 flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <p className="text-sm">Loading invitation…</p>
          </div>
        ) : !session ? null : inv === null || inv?.status === "canceled" || inv?.status === "rejected" ? (
          <div className="mt-6">
            <h1 className="text-lg font-semibold tracking-tight">Invitation unavailable</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              This invitation is invalid, expired, or already used.
            </p>
            <Button variant="outline" className="mt-5" onClick={() => router.push("/home")}>
              Go to Tacto
            </Button>
          </div>
        ) : (
          <div className="mt-6">
            <h1 className="text-lg font-semibold tracking-tight">
              Join {inv?.organizationName ?? "the workspace"}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              You have been invited to collaborate{inv?.role ? ` as ${inv.role}` : ""}.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button onClick={accept} disabled={accepting}>
                {accepting && <Loader2 className="size-4 animate-spin" />}
                Accept invitation
              </Button>
              <Button variant="ghost" onClick={decline} disabled={accepting}>
                Decline
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
