"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signUpSchema } from "@workspace/contracts/auth"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Separator } from "@workspace/ui/components/separator"

import { authClient } from "@/lib/auth-client"

export default function SignUpPage() {
  const router = useRouter()
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const parsed = signUpSchema.safeParse({ name, email, password })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details")
      return
    }

    setSubmitting(true)
    const { error: authError } = await authClient.signUp.email(parsed.data)
    if (authError) {
      setError(authError.message ?? "Could not create your account")
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
      <h1 className="font-serif text-3xl tracking-tight">
        Capture once, teach forever.
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Create your account.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Lovelace"
          />
        </div>
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-muted-foreground font-mono text-xs">
            at least 8 characters
          </p>
        </div>

        {error && (
          <p role="alert" className="text-signal text-sm">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
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
        Already have an account?{" "}
        <Link href="/sign-in" className="text-viridian hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
