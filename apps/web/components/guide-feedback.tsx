"use client"

import * as React from "react"
import { toast } from "sonner"

import { REACTION_EMOJIS } from "@workspace/contracts/guide"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

import { formatDate } from "@/lib/format"
import type { GuideComment, GuideReactionCount } from "@/lib/public-guide"

/** Stable per-browser id for anonymous reactions/comments. */
function useAnonId(): string {
  const [id, setId] = React.useState("")
  React.useEffect(() => {
    const KEY = "tacto_anon_id"
    let v = localStorage.getItem(KEY)
    if (!v) {
      v = crypto.randomUUID()
      localStorage.setItem(KEY, v)
    }
    setId(v)
  }, [])
  return id
}

/**
 * Reactions + comments for a published guide. Each is shown only when the
 * owner enabled it in Customization → Feedback. Writes go to the public
 * feedback endpoints; anonymous identity is a localStorage id.
 */
export function GuideFeedback({
  shareId,
  allowReactions,
  allowComments,
  initialReactions,
  initialComments,
}: {
  shareId: string
  allowReactions: boolean
  allowComments: boolean
  initialReactions: GuideReactionCount[]
  initialComments: GuideComment[]
}) {
  if (!allowReactions && !allowComments) return null
  return (
    <div className="mt-16 border-t pt-10">
      {allowReactions && (
        <Reactions shareId={shareId} initial={initialReactions} />
      )}
      {allowComments && (
        <Comments
          shareId={shareId}
          initial={initialComments}
          className={allowReactions ? "mt-12" : undefined}
        />
      )}
    </div>
  )
}

function Reactions({
  shareId,
  initial,
}: {
  shareId: string
  initial: GuideReactionCount[]
}) {
  const anonId = useAnonId()
  const [counts, setCounts] = React.useState<Record<string, number>>(() =>
    Object.fromEntries(initial.map((r) => [r.emoji, r.count]))
  )
  const [mine, setMine] = React.useState<Set<string>>(new Set())
  const [busy, setBusy] = React.useState(false)

  // Which reactions this browser has left (persisted per guide).
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(`tacto_reacted_${shareId}`)
      if (raw) setMine(new Set(JSON.parse(raw) as string[]))
    } catch {
      /* ignore */
    }
  }, [shareId])

  async function toggle(emoji: string) {
    if (!anonId || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/public/guides/${shareId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji, anonId }),
      })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as {
        reactions: GuideReactionCount[]
        reacted: boolean
      }
      setCounts(Object.fromEntries(data.reactions.map((r) => [r.emoji, r.count])))
      setMine((prev) => {
        const next = new Set(prev)
        if (data.reacted) next.add(emoji)
        else next.delete(emoji)
        try {
          localStorage.setItem(
            `tacto_reacted_${shareId}`,
            JSON.stringify([...next])
          )
        } catch {
          /* ignore */
        }
        return next
      })
    } catch {
      toast.error("Couldn't save your reaction")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <p className="text-muted-foreground mb-3 font-mono text-xs tracking-widest uppercase">
        Was this helpful?
      </p>
      <div className="flex flex-wrap gap-2">
        {REACTION_EMOJIS.map((emoji) => {
          const count = counts[emoji] ?? 0
          const active = mine.has(emoji)
          return (
            <button
              key={emoji}
              onClick={() => toggle(emoji)}
              disabled={busy}
              aria-pressed={active}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-60",
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "hover:bg-muted"
              )}
            >
              <span className="text-base leading-none">{emoji}</span>
              {count > 0 && (
                <span className="font-mono text-xs tabular-nums">{count}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Comments({
  shareId,
  initial,
  className,
}: {
  shareId: string
  initial: GuideComment[]
  className?: string
}) {
  const [comments, setComments] = React.useState<GuideComment[]>(initial)
  const [name, setName] = React.useState("")
  const [body, setBody] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  // Remember the commenter's name across guides.
  React.useEffect(() => {
    setName(localStorage.getItem("tacto_comment_name") ?? "")
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !name.trim() || !body.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`/api/public/guides/${shareId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName: name.trim(), body: body.trim() }),
      })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as { comment: GuideComment }
      setComments((prev) => [...prev, data.comment])
      setBody("")
      localStorage.setItem("tacto_comment_name", name.trim())
    } catch {
      toast.error("Couldn't post your comment")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={className}>
      <p className="text-muted-foreground mb-4 font-mono text-xs tracking-widest uppercase">
        {comments.length > 0 ? `${comments.length} comments` : "Comments"}
      </p>

      <div className="flex flex-col gap-5">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium uppercase">
              {c.authorName.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">{c.authorName}</span>
                <span className="text-muted-foreground font-mono text-[11px]">
                  {formatDate(c.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap">
                {c.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={80}
          className="max-w-xs"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment…"
          maxLength={2000}
          rows={3}
          className="border-input placeholder:text-muted-foreground focus-visible:ring-ring w-full resize-y rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2"
        />
        <div>
          <Button
            type="submit"
            size="sm"
            disabled={busy || !name.trim() || !body.trim()}
          >
            {busy ? "Posting…" : "Post comment"}
          </Button>
        </div>
      </form>
    </div>
  )
}
