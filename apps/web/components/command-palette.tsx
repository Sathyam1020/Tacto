"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CornerDownLeft } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { HomeIcon } from "@workspace/ui/components/home"
import { SearchIcon } from "@workspace/ui/components/search"
import { SettingsIcon } from "@workspace/ui/components/settings"
import { SparklesIcon } from "@workspace/ui/components/sparkles"
import { cn } from "@workspace/ui/lib/utils"

type Command = {
  id: string
  label: string
  hint: string
  keywords: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  run: () => void
}

/**
 * ⌘K command palette — the fast path through the app. Opens anywhere with
 * ⌘K / Ctrl-K, filters commands, arrow-key + Enter to run. Mounted once in
 * the app shell.
 */
export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [active, setActive] = React.useState(0)

  const commands = React.useMemo<Command[]>(
    () => [
      {
        id: "home",
        label: "Go to Home",
        hint: "Dashboard",
        keywords: "home dashboard guides recent",
        icon: HomeIcon,
        run: () => router.push("/home"),
      },
      {
        id: "settings",
        label: "Open Settings",
        hint: "Workspace",
        keywords: "settings account workspace members",
        icon: SettingsIcon,
        run: () => router.push("/settings"),
      },
      {
        id: "capture",
        label: "New capture",
        hint: "Record a workflow",
        keywords: "capture record new guide create",
        icon: SparklesIcon,
        run: () => router.push("/home"),
      },
    ],
    [router]
  )

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) =>
      `${c.label} ${c.keywords}`.toLowerCase().includes(q)
    )
  }, [commands, query])

  // Global open shortcut.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Reset highlight as the list changes.
  React.useEffect(() => setActive(0), [query, open])

  function runCommand(command: Command) {
    setOpen(false)
    setQuery("")
    command.run()
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const command = results[active]
      if (command) runCommand(command)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="top-[16%] w-[calc(100%-2rem)] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-3 border-b px-4">
          <SearchIcon size={17} className="text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search commands…"
            aria-label="Search commands"
            className="placeholder:text-muted-foreground h-12 w-full bg-transparent text-sm outline-none"
          />
          <kbd className="text-muted-foreground border-border rounded border px-1.5 py-0.5 font-mono text-[10px]">
            ESC
          </kbd>
        </div>
        <div className="max-h-[min(24rem,60vh)] overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <p className="text-muted-foreground px-3 py-8 text-center text-sm">
              No commands match “{query}”.
            </p>
          ) : (
            results.map((command, i) => (
              <button
                key={command.id}
                onClick={() => runCommand(command)}
                onPointerMove={() => setActive(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
                  i === active
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground"
                )}
              >
                <command.icon size={18} className="shrink-0" />
                <span className="flex-1 truncate text-sm font-medium">
                  {command.label}
                </span>
                <span className="text-muted-foreground font-mono text-[10px]">
                  {command.hint}
                </span>
                {i === active && (
                  <CornerDownLeft className="text-muted-foreground size-3.5" />
                )}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
