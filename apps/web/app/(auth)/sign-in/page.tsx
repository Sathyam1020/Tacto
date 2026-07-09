"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signInSchema } from "@workspace/contracts/auth"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Separator } from "@workspace/ui/components/separator"

import { authClient } from "@/lib/auth-client"

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const parsed = signInSchema.safeParse({ email, password })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details")
      return
    }

    setSubmitting(true)
    const { error: authError } = await authClient.signIn.email(parsed.data)
    if (authError) {
      setError(authError.message ?? "Could not sign you in")
      setSubmitting(false)
      return
    }
    router.push("/home")
  }

  async function handleGoogle() {
    setError(null)
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/home",
    })
  }

  return (
    <div>
      <h1 className="font-serif text-3xl font-medium tracking-tight">Welcome back.</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Sign in to your workspace.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="text-signal text-sm">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-muted-foreground font-mono text-xs">or</span>
        <Separator className="flex-1" />
      </div>

      <Button
        variant="outline"
        size="lg"
        className="w-full"
        onClick={handleGoogle}
      >
        Continue with Google
      </Button>

      <p className="text-muted-foreground mt-8 text-sm">
        New to Tacto?{" "}
        <Link href="/sign-up" className="text-viridian hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  )
}
