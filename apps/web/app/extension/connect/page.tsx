"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@workspace/ui/components/button"
import { LogoMark } from "@workspace/ui/components/logo"
import { TouchRing } from "@workspace/ui/components/touch-ring"

import { api } from "@/lib/api"
import { authClient } from "@/lib/auth-client"

/**
 * Extension connect handoff. When the user is signed in, fetch the current
 * session's bearer token and postMessage it to the extension's connect
 * content script, which relays it to the extension background. The extension
 * never touches the password.
 */
export default function ExtensionConnectPage() {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const [state, setState] = React.useState<
    "idle" | "connecting" | "connected" | "error"
  >("idle")

  React.useEffect(() => {
    if (isPending || !session) return
    let cancelled = false
    setState("connecting")
    api
      .get<{ token: string }>("/extension/token")
      .then(({ data }) => {
        if (cancelled) return
        // The app bridge content script listens for this on window.
        window.postMessage(
          { source: "tacto-web", type: "connect-token", token: data.token },
          window.location.origin
        )
        setState("connected")
        // Give the bridge a beat to relay, then return to the app (the gate
        // will now see the extension as connected).
        window.setTimeout(() => !cancelled && router.push("/home"), 1200)
      })
      .catch(() => !cancelled && setState("error"))
    return () => {
      cancelled = true
    }
  }, [isPending, session, router])

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6 text-center">
      <LogoMark className="size-9" />

      {isPending ? null : !session ? (
        <div className="mt-8">
          <h1 className="font-serif text-2xl font-medium tracking-tight">
            Sign in to connect
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Sign in to Tacto, then the extension will connect automatically.
          </p>
          <Button
            size="lg"
            className="mt-6"
            render={<Link href="/sign-in?next=/extension/connect" />}
          >
            Sign in
          </Button>
        </div>
      ) : state === "connected" ? (
        <div className="mt-8">
          <TouchRing size="lg" />
          <h1 className="mt-6 font-serif text-2xl font-medium tracking-tight">
            Extension connected.
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            You can close this tab and start capturing from the Tacto
            extension.
          </p>
        </div>
      ) : state === "error" ? (
        <div className="mt-8">
          <h1 className="font-serif text-2xl font-medium tracking-tight">
            Couldn&apos;t connect
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Something went wrong. Reload this page to try again.
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground mt-8 font-mono text-sm">
          Connecting…
        </p>
      )}
    </div>
  )
}
