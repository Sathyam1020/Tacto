"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  BarChart3,
  BookOpen,
  Code2,
  Copy,
  Eye,
  EyeOff,
  FileText,
  LifeBuoy,
  MoreHorizontal,
  Palette,
  Plus,
  Rocket,
  Settings2,
  Trash2,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { SquarePenIcon } from "@workspace/ui/components/square-pen"
import { cn } from "@workspace/ui/lib/utils"

import { ViewRow } from "@/components/app-shell/shell-bits"
import {
  useCreateCollection,
  useDeleteCollection,
  useDuplicateCollection,
  useHelpCenter,
  useUpdateCollection,
} from "@/lib/help-center"

/** Curated collection icons (mirrors the contract's COLLECTION_ICONS). */
const ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Rocket,
  BookOpen,
  Users,
  BarChart3,
  Code2,
  LifeBuoy,
  Settings2,
}

/** The Help Center's second sidebar column: All articles + collections +
 *  Design/Settings. URL-driven selection (?tab / ?c) shared with the page. */
export function HelpCenterPanel() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const { data: hc } = useHelpCenter()

  const create = useCreateCollection()
  const rename = useUpdateCollection()
  const duplicate = useDuplicateCollection()
  const del = useDeleteCollection()

  const [creating, setCreating] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [renaming, setRenaming] = React.useState<string | null>(null)

  const tab = params.get("tab")
  const activeC = params.get("c")
  const onContent = pathname === "/help-center" && !tab

  const go = (q: string) => router.push(`/help-center${q}`)

  function submitNew() {
    const name = newName.trim()
    setCreating(false)
    setNewName("")
    if (!name) return
    create.mutate(
      { name },
      {
        onSuccess: (res) => {
          const added = res.detail.collections.find((c) => c.name === name)
          if (added) go(`?c=${added.id}`)
        },
        onError: () => toast.error("Couldn't create the collection"),
      }
    )
  }

  function submitRename(id: string, value: string) {
    setRenaming(null)
    const name = value.trim()
    if (!name) return
    rename.mutate(
      { id, name },
      { onError: () => toast.error("Couldn't rename the collection") }
    )
  }

  return (
    <aside className="mt-1.5 mb-1.5 flex w-64 flex-none flex-col overflow-hidden rounded-l-3xl border-t border-r border-b border-l border-[var(--l-hairline)] bg-gradient-to-b from-[var(--l-panel-a)] to-[var(--l-panel-b)]">
      <div className="flex h-14 items-center justify-between border-b border-[var(--l-hairline)] px-4">
        <h2 className="text-[15px] font-semibold tracking-tight">Help Center</h2>
        <button
          aria-label="New collection"
          onClick={() => setCreating(true)}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <ViewRow
          active={onContent && !activeC}
          onClick={() => go("")}
          icon={<FileText className="size-4" />}
          label="All articles"
          count={hc?.collections.reduce((n, c) => n + c.articles.length, 0)}
        />

        <div className="mt-4 mb-1 flex items-center justify-between px-2.5">
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Collections
          </span>
          <button
            aria-label="New collection"
            onClick={() => setCreating(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        {(hc?.collections ?? []).map((c) => {
          const Icon = ICON[c.icon ?? ""] ?? BookOpen
          const active = onContent && activeC === c.id
          if (renaming === c.id) {
            return (
              <input
                key={c.id}
                autoFocus
                defaultValue={c.name}
                onBlur={(e) => submitRename(c.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur()
                  if (e.key === "Escape") setRenaming(null)
                }}
                className="mx-0.5 mb-0.5 w-[calc(100%-4px)] rounded-lg border border-cobalt bg-plate px-2.5 py-1.5 text-[13px] outline-none"
              />
            )
          }
          return (
            <div
              key={c.id}
              className={cn(
                "group flex items-center rounded-lg pr-1 transition-colors",
                active ? "bg-foreground/[0.09]" : "hover:bg-foreground/[0.06]"
              )}
            >
              <button
                onClick={() => go(`?c=${c.id}`)}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-[13px]",
                  active ? "font-medium text-cobalt-ink" : "text-foreground",
                  c.hidden && "opacity-55"
                )}
              >
                <Icon
                  className={cn("size-4 flex-none", active ? "text-cobalt" : "text-muted-foreground")}
                />
                <span className="truncate">{c.name}</span>
                {c.hidden && <EyeOff className="size-3 flex-none text-muted-foreground" />}
              </button>
              <span className="mr-0.5 font-mono text-[10px] text-muted-foreground group-hover:hidden">
                {c.articles.length}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`${c.name} actions`}
                  className="hidden size-6 items-center justify-center rounded-md text-muted-foreground group-hover:flex hover:text-foreground data-[popup-open]:flex data-[popup-open]:text-foreground"
                >
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => setRenaming(c.id)}>
                    <SquarePenIcon size={15} />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      duplicate.mutate(c.id, {
                        onSuccess: () => toast.success("Collection duplicated"),
                        onError: () => toast.error("Couldn't duplicate"),
                      })
                    }
                  >
                    <Copy className="size-4" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      rename.mutate({ id: c.id, hidden: !c.hidden })
                    }
                  >
                    {c.hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                    {c.hidden ? "Show" : "Hide"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() =>
                      del.mutate(c.id, {
                        onSuccess: () => {
                          toast.success("Collection deleted")
                          if (activeC === c.id) go("")
                        },
                        onError: () => toast.error("Couldn't delete"),
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })}

        {creating && (
          <div className="mt-0.5 px-0.5">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={submitNew}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNew()
                if (e.key === "Escape") {
                  setCreating(false)
                  setNewName("")
                }
              }}
              placeholder="Collection name"
              className="w-full rounded-lg border border-cobalt bg-plate px-2.5 py-1.5 text-[13px] outline-none"
            />
          </div>
        )}
      </div>

      {/* Design + Settings */}
      <div className="border-t border-[var(--l-hairline)] p-2">
        <PanelNav icon={<Palette className="size-4" />} label="Design" active={tab === "design"} onClick={() => go("?tab=design")} />
        <PanelNav icon={<Settings2 className="size-4" />} label="Settings" active={tab === "settings"} onClick={() => go("?tab=settings")} />
      </div>
    </aside>
  )
}

function PanelNav({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors",
        active ? "bg-primary/10 font-medium text-cobalt" : "text-foreground hover:bg-foreground/[0.06]"
      )}
    >
      {icon}
      {label}
    </button>
  )
}
