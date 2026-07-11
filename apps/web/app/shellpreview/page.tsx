"use client"

import * as React from "react"
import { AnimatePresence, m } from "motion/react"
import {
  Check,
  ClipboardList,
  Clock,
  Folder,
  FolderOpen,
  LifeBuoy,
  Menu,
  Moon,
  MoreHorizontal,
  Plus,
  Star,
  Sun,
  Trash2,
  Users,
  Video,
  X,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { SearchIcon } from "@workspace/ui/components/search"
import { SettingsIcon } from "@workspace/ui/components/settings"
import { SquarePenIcon } from "@workspace/ui/components/square-pen"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

import { EmptyState } from "@/components/datum/empty-state"
import { staggerItem } from "@/components/datum/motion"
import { GuideCard } from "@/components/guide-card"
import type { GuideListItem } from "@/lib/guides"

/* ── Sample data (in-memory; swaps for the API later) ─────────────────── */
type Folder = { id: string; name: string }
type Guide = GuideListItem & { folderId: string | null }

const mk = (
  id: string,
  title: string,
  folderId: string | null,
  steps: number,
  pinned = false,
  status: GuideListItem["status"] = "PUBLISHED"
): Guide => ({
  id,
  title,
  summary: null,
  status,
  shareId: id,
  stepCount: steps,
  coverUrl: null,
  pinnedAt: pinned ? "2026-07-10T00:00:00Z" : null,
  viewCount: 0,
  aiGenerated: id !== "3" && id !== "6" && id !== "9",
  author: { name: "Sathyam", image: null },
  folderId,
  createdAt: "2026-07-08T00:00:00Z",
  updatedAt: "2026-07-10T00:00:00Z",
})

const INITIAL_FOLDERS: Folder[] = [
  { id: "onb", name: "Onboarding" },
  { id: "sup", name: "Support" },
  { id: "sales", name: "Sales demos" },
  { id: "int", name: "Internal docs" },
]
const SUMMARIES: Record<string, string> = {
  "1": "Send an invite, pick a role, and confirm access in seconds.",
  "2": "Wire up your identity provider so the team signs in with one click.",
  "3": "Add your name, photo, and timezone to finish setup.",
  "4": "Verify the account and trigger a secure reset link.",
  "5": "Attach context and route the ticket to the right engineer.",
  "6": "Locate the charge, confirm the amount, and process the refund.",
  "7": "Walk a prospect through the core flow end to end.",
  "8": "Turn any guide into a clickable demo you can send in a link.",
  "9": "Ship the latest build to production with the release checklist.",
  "10": "Generate new keys, update secrets, and revoke the old ones.",
  "11": "Authorize Slack and choose where notifications land.",
  "12": "Pick a date range and download a clean CSV of your data.",
}
const INITIAL_GUIDES: Guide[] = [
  mk("1", "Invite a teammate and set their role", "onb", 5, true),
  mk("2", "Set up SSO for your workspace", "onb", 6, false, "DRAFT"),
  mk("3", "Complete your workspace profile", "onb", 4),
  mk("4", "Reset a customer's password", "sup", 3, true),
  mk("5", "Escalate a ticket to engineering", "sup", 7, false, "DRAFT"),
  mk("6", "Issue a refund in the billing panel", "sup", 5),
  mk("7", "Run the product tour for a prospect", "sales", 8),
  mk("8", "Share a guide as an interactive demo", "sales", 4, true),
  mk("9", "Deploy the app to production", "int", 9),
  mk("10", "Rotate API keys safely", "int", 6, false, "DRAFT"),
  mk("11", "Connect your Slack workspace", null, 4),
  mk("12", "Export your data to CSV", null, 3),
].map((g): Guide => ({ ...g, summary: SUMMARIES[g.id] ?? g.summary }))
/* Recently added — drives the "New" dot + the Recent view. */
const NEW_IDS = new Set(["3", "8", "10"])

const Reticle = ({ size = 24 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 22 22"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <circle cx="11" cy="11" r="4.4" />
    <circle cx="11" cy="11" r="1.6" fill="currentColor" stroke="none" />
    <path d="M11 1.5v3M11 17.5v3M1.5 11h3M17.5 11h3" />
  </svg>
)

/* Grid fade + stagger — crossfades between folders. */
const gridV = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, when: "beforeChildren" as const },
  },
  exit: { opacity: 0, transition: { duration: 0.12 } },
}

/* Rail icon button with a right-side tooltip. */
function RailButton({
  active,
  label,
  children,
}: {
  active?: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            aria-label={label}
            className={cn(
              "flex size-10 items-center justify-center rounded-xl transition-[color,background-color,box-shadow,transform] duration-150 active:scale-90",
              active
                ? "bg-[var(--l-lift)] text-cobalt shadow-[inset_0_1px_0_var(--l-edge)]"
                : "text-muted-foreground hover:bg-[var(--l-hover)] hover:text-foreground"
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

function ViewRow({
  active,
  onClick,
  icon,
  label,
  count,
  newBadge,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  count?: number
  newBadge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-150",
        active
          ? "bg-cobalt-tint font-medium text-cobalt-ink"
          : "text-foreground hover:bg-muted"
      )}
    >
      <span className={active ? "text-cobalt" : "text-muted-foreground"}>
        {icon}
      </span>
      {label}
      <span className="ml-auto flex items-center gap-1.5">
        {newBadge ? (
          <span className="rounded-full bg-cobalt px-1.5 py-px font-mono text-[9px] font-semibold text-white">
            {newBadge} new
          </span>
        ) : null}
        {count !== undefined ? (
          <span
            className={cn(
              "font-mono text-[10px]",
              active ? "text-cobalt-ink/70" : "text-muted-foreground"
            )}
          >
            {count}
          </span>
        ) : null}
      </span>
    </button>
  )
}

/* Constant Library header — tracked date eyebrow + time-aware greeting.
   Computed after mount so server/client render match (no hydration drift). */
function LibraryGreeting() {
  const [now, setNow] = React.useState<Date | null>(null)
  React.useEffect(() => setNow(new Date()), [])

  const dateLabel = now
    ? now.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : " "
  const hour = now?.getHours() ?? -1
  const greeting =
    hour < 0
      ? " "
      : hour < 5
        ? "Working late, Sathyam."
        : hour < 12
          ? "Good morning, Sathyam."
          : hour < 17
            ? "Good afternoon, Sathyam."
            : hour < 22
              ? "Good evening, Sathyam."
              : "Working late, Sathyam."

  return (
    <div className="mb-6">
      <p className="font-mono text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
        {dateLabel}
      </p>
      <h2 className="mt-1.5 text-[26px] font-semibold tracking-[-0.02em] text-foreground">
        {greeting}
      </h2>
    </div>
  )
}

/* Folder-row indicators — one component, one meaning for each mark:
   • blue dot        → the folder has new / unread guide activity
   • orange pill (n) → n guides need review / action (drafts pending)
   • gray number     → total guide count (no action needed) */
function FolderIndicators({
  hasNew,
  reviewCount,
  total,
  active,
}: {
  hasNew: boolean
  reviewCount: number
  total: number
  active: boolean
}) {
  return (
    <span className="flex items-center gap-1.5">
      {hasNew ? (
        <span
          className="size-1.5 rounded-full bg-cobalt"
          title="New guide activity"
        />
      ) : null}
      {reviewCount > 0 ? (
        <span
          title={`${reviewCount} guide${reviewCount > 1 ? "s" : ""} need review`}
          className="rounded bg-amber-tint px-1.5 py-px font-mono text-[9px] font-medium text-amber-ink"
        >
          {reviewCount}
        </span>
      ) : null}
      <span
        title={`${total} guide${total === 1 ? "" : "s"}`}
        className={cn(
          "font-mono text-[10px]",
          active ? "text-cobalt-ink/70" : "text-muted-foreground"
        )}
      >
        {total}
      </span>
    </span>
  )
}

type View = { type: "all" | "pinned" | "recent" | "folder"; id?: string }

/* Linear system, scoped to this preview and toggleable between dark and light.
   Because the Datum tokens are live `var()` refs, redefining them here recolors
   every token-based utility (foreground, primary, cobalt, popover, card, …) on
   the shell AND the cards — including dropdowns, inputs, dialogs. The custom
   `--l-*` vars carry the surface ladder + effects that aren't shadcn tokens, so
   the whole tree flips theme by swapping one style object. Lavender (#5e6ad2)
   stays the sole accent; the surface ladder keeps rail darkest → content
   lightest in both themes. */
const L_DARK = {
  "--background": "#08090b",
  "--foreground": "#f7f8f8",
  "--card": "#17181c",
  "--card-foreground": "#f7f8f8",
  "--popover": "#1c1d22",
  "--popover-foreground": "#f7f8f8",
  "--primary": "#5e6ad2",
  "--primary-foreground": "#ffffff",
  "--secondary": "#212228",
  "--secondary-foreground": "#f7f8f8",
  "--muted": "#212228",
  "--muted-foreground": "#8a8f98",
  "--accent": "#23252a",
  "--accent-foreground": "#f7f8f8",
  "--border": "#23252a",
  "--input": "#2a2c31",
  "--ring": "#5e6ad2",
  "--destructive": "#eb5757",
  "--cobalt": "#5e6ad2",
  "--cobalt-ink": "#f7f8f8",
  "--cobalt-tint": "#212228",
  "--amber-tint": "#212228",
  "--amber-ink": "#8a8f98",
  "--plate": "#17181c",
  "--ink": "#f7f8f8",
  "--paper": "#08090b",
  "--l-canvas": "#08090b",
  "--l-rail-a": "#0b0c0f",
  "--l-rail-b": "#060709",
  "--l-panel-a": "#15161b",
  "--l-panel-b": "#0e0f13",
  "--l-content-a": "#1c1d22",
  "--l-content-b": "#141519",
  "--l-card": "#202127",
  "--l-card-hover": "#24252b",
  "--l-lift": "#1c1d22",
  "--l-chrome": "#16171b",
  "--l-preview": "#0e0f12",
  "--l-preview-base": "#101114",
  "--l-dot": "#33363c",
  "--l-skel-card": "#17181c",
  "--l-skel-accent": "#4a4e57",
  "--l-skel-tint": "#2f323a",
  "--l-hairline": "#23252a",
  "--l-hairline-strong": "#2c2e34",
  "--l-ink": "#f7f8f8",
  "--l-ink-subtle": "#8a8f98",
  "--l-ink-tertiary": "#62666d",
  "--l-edge": "rgba(255,255,255,0.05)",
  "--l-hover": "rgba(255,255,255,0.06)",
  "--l-placeholder": "rgba(255,255,255,0.015)",
  "--l-placeholder-hover": "rgba(255,255,255,0.03)",
  "--l-card-shadow": "0 16px 40px -18px rgba(0,0,0,0.6)",
  "--l-pin-ring": "#16171b",
  "--l-success": "#27a644",
  "--l-success-ring": "rgba(39,166,68,0.35)",
  "--l-ai-bg": "rgba(94,106,210,0.15)",
  "--l-ai-text": "#aab2f5",
  "--l-ai-ring": "rgba(94,106,210,0.30)",
  "--l-clo-bg": "rgba(235,87,87,0.12)",
  "--l-clo-fg": "#f0888a",
  "--l-clo-ring": "rgba(235,87,87,0.25)",
  "--l-cmid-bg": "rgba(224,165,60,0.12)",
  "--l-cmid-fg": "#e6b866",
  "--l-cmid-ring": "rgba(224,165,60,0.25)",
  "--l-chi-bg": "rgba(39,166,68,0.15)",
  "--l-chi-fg": "#5fd07a",
  "--l-chi-ring": "rgba(39,166,68,0.30)",
} as React.CSSProperties

const L_LIGHT = {
  "--background": "#eceef2",
  "--foreground": "#16171b",
  "--card": "#ffffff",
  "--card-foreground": "#16171b",
  "--popover": "#ffffff",
  "--popover-foreground": "#16171b",
  "--primary": "#5e6ad2",
  "--primary-foreground": "#ffffff",
  "--secondary": "#f1f2f6",
  "--secondary-foreground": "#16171b",
  "--muted": "#e6e8ee",
  "--muted-foreground": "#6b6f76",
  "--accent": "#e6e8ee",
  "--accent-foreground": "#16171b",
  "--border": "#dcdfe6",
  "--input": "#d6d9e1",
  "--ring": "#5e6ad2",
  "--destructive": "#dc2626",
  "--cobalt": "#5e6ad2",
  "--cobalt-ink": "#16171b",
  "--cobalt-tint": "#e8eaf6",
  "--amber-tint": "#e6e8ee",
  "--amber-ink": "#6b6f76",
  "--plate": "#ffffff",
  "--ink": "#16171b",
  "--paper": "#eceef2",
  "--l-canvas": "#eceef2",
  "--l-rail-a": "#e3e5ea",
  "--l-rail-b": "#d9dce3",
  "--l-panel-a": "#edeff3",
  "--l-panel-b": "#e4e6ec",
  "--l-content-a": "#f8f9fb",
  "--l-content-b": "#eef0f4",
  "--l-card": "#ffffff",
  "--l-card-hover": "#ffffff",
  "--l-lift": "#f1f2f6",
  "--l-chrome": "#f4f5f8",
  "--l-preview": "#f4f5f8",
  "--l-preview-base": "#ffffff",
  "--l-dot": "#c4c8d2",
  "--l-skel-card": "#f4f5f8",
  "--l-skel-accent": "#c8ccd6",
  "--l-skel-tint": "#d6d9e1",
  "--l-hairline": "#dcdfe6",
  "--l-hairline-strong": "#c8ccd6",
  "--l-ink": "#16171b",
  "--l-ink-subtle": "#6b6f76",
  "--l-ink-tertiary": "#9297a1",
  "--l-edge": "rgba(255,255,255,0.9)",
  "--l-hover": "rgba(0,0,0,0.04)",
  "--l-placeholder": "rgba(0,0,0,0.015)",
  "--l-placeholder-hover": "rgba(0,0,0,0.03)",
  "--l-card-shadow": "0 12px 30px -16px rgba(20,22,40,0.16)",
  "--l-pin-ring": "#f8f9fb",
  "--l-success": "#1f9d3f",
  "--l-success-ring": "rgba(31,157,63,0.30)",
  "--l-ai-bg": "rgba(94,106,210,0.12)",
  "--l-ai-text": "#4d58c9",
  "--l-ai-ring": "rgba(94,106,210,0.28)",
  "--l-clo-bg": "rgba(220,60,60,0.10)",
  "--l-clo-fg": "#c0392b",
  "--l-clo-ring": "rgba(220,60,60,0.28)",
  "--l-cmid-bg": "rgba(180,120,20,0.12)",
  "--l-cmid-fg": "#a16207",
  "--l-cmid-ring": "rgba(180,120,20,0.30)",
  "--l-chi-bg": "rgba(31,157,63,0.12)",
  "--l-chi-fg": "#157f38",
  "--l-chi-ring": "rgba(31,157,63,0.30)",
} as React.CSSProperties

export default function ShellPreview() {
  const [folders, setFolders] = React.useState<Folder[]>(INITIAL_FOLDERS)
  const [guides, setGuides] = React.useState<Guide[]>(INITIAL_GUIDES)
  const [view, setViewState] = React.useState<View>({
    type: "folder",
    id: "onb",
  })
  const [query, setQuery] = React.useState("")
  const [creating, setCreating] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [renaming, setRenaming] = React.useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [theme, setTheme] = React.useState<"dark" | "light">("dark")

  function setView(v: View) {
    setViewState(v)
    setMobileOpen(false)
  }

  const counts = React.useMemo(() => {
    const byFolder: Record<string, number> = {}
    const drafts: Record<string, number> = {}
    const fresh: Record<string, number> = {}
    for (const g of guides)
      if (g.folderId) {
        byFolder[g.folderId] = (byFolder[g.folderId] ?? 0) + 1
        if (g.status === "DRAFT")
          drafts[g.folderId] = (drafts[g.folderId] ?? 0) + 1
        if (NEW_IDS.has(g.id)) fresh[g.folderId] = (fresh[g.folderId] ?? 0) + 1
      }
    return {
      all: guides.length,
      pinned: guides.filter((g) => g.pinnedAt).length,
      recentNew: NEW_IDS.size,
      byFolder,
      drafts,
      fresh,
    }
  }, [guides])

  const shown = React.useMemo(() => {
    let list = guides
    if (view.type === "pinned") list = list.filter((g) => g.pinnedAt)
    else if (view.type === "recent") list = [...guides].reverse().slice(0, 8)
    else if (view.type === "folder")
      list = list.filter((g) => g.folderId === view.id)
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((g) => g.title.toLowerCase().includes(q))
    return list
  }, [guides, view, query])

  const title =
    view.type === "all"
      ? "All guides"
      : view.type === "pinned"
        ? "Pinned"
        : view.type === "recent"
          ? "Recent"
          : (folders.find((f) => f.id === view.id)?.name ?? "Folder")

  function createFolder() {
    const name = newName.trim()
    if (!name) return setCreating(false)
    const id = `f${Date.now()}`
    setFolders((f) => [...f, { id, name }])
    setViewState({ type: "folder", id })
    setNewName("")
    setCreating(false)
  }
  function deleteFolder(id: string) {
    setGuides((gs) =>
      gs.map((g) => (g.folderId === id ? { ...g, folderId: null } : g))
    )
    setFolders((f) => f.filter((x) => x.id !== id))
    if (view.type === "folder" && view.id === id) setViewState({ type: "all" })
  }

  const viewKey = view.type === "folder" ? `folder-${view.id}` : view.type

  return (
    <div
      style={theme === "light" ? L_LIGHT : L_DARK}
      className="relative flex h-svh overflow-hidden bg-[var(--l-canvas)] text-foreground"
    >
      {/* mobile backdrop */}
      {mobileOpen && (
        <button
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
        />
      )}

      {/* ── Sidebar group (rail + folders) ────────────────────── */}
      <div
        className={cn(
          "z-50 flex h-svh bg-gradient-to-b from-[var(--l-rail-a)] to-[var(--l-rail-b)]",
          "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:transition-transform max-md:duration-200",
          mobileOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full"
        )}
      >
        {/* Icon rail */}
        <nav className="flex w-14 flex-none flex-col items-center gap-1.5 py-3.5">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Switch workspace"
              className="mb-2 flex size-10 items-center justify-center rounded-xl text-cobalt transition-colors hover:bg-[var(--l-hover)]"
            >
              <Reticle />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                  Workspaces
                </DropdownMenuLabel>
                <DropdownMenuItem>
                  <span className="flex size-5 items-center justify-center rounded bg-ink text-[10px] font-semibold text-paper">
                    S
                  </span>
                  <span className="flex-1">Seed&apos;s Workspace</span>
                  <Check className="size-4 text-cobalt" />
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <span className="flex size-5 items-center justify-center rounded bg-[#3f5a86] text-[10px] font-semibold text-white">
                    A
                  </span>
                  <span className="flex-1">Acme Support</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Plus className="size-4" />
                Create workspace
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <RailButton label="Library" active>
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M4 5a1 1 0 0 1 1-1h5l2 2h7a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
            </svg>
          </RailButton>
          <RailButton label="Forms">
            <ClipboardList className="size-[19px]" />
          </RailButton>
          <RailButton label="Analytics">
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
            </svg>
          </RailButton>
          <RailButton label="Teams">
            <Users className="size-[19px]" />
          </RailButton>
          <div className="flex-1" />
          <RailButton label="Help center">
            <LifeBuoy className="size-[19px]" />
          </RailButton>
          <RailButton label="Settings">
            <SettingsIcon size={19} />
          </RailButton>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Account"
              className="mt-1 flex size-9 items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-ink text-xs font-semibold text-paper">
                S
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-52">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Sathyam</DropdownMenuLabel>
                <DropdownMenuItem>Account settings</DropdownMenuItem>
                <DropdownMenuItem>Sign out</DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                  Appearance
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  <Sun className="size-4" />
                  Light
                  {theme === "light" && <Check className="ml-auto size-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  <Moon className="size-4" />
                  Dark
                  {theme === "dark" && <Check className="ml-auto size-4" />}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Folders panel — rounded on the right, softest shadow */}
        <aside className="mt-1.5 mb-1.5 flex w-64 flex-none flex-col overflow-hidden rounded-l-3xl border-t border-r border-b border-l border-[var(--l-hairline)] bg-gradient-to-b from-[var(--l-panel-a)] to-[var(--l-panel-b)]">
          <div className="flex h-14 items-center justify-between border-b px-4">
            <h2 className="text-[15px] font-semibold tracking-tight">
              Library
            </h2>
            <button
              aria-label="New folder"
              onClick={() => setCreating(true)}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Plus className="size-4" />
            </button>
          </div>

          <div className="px-3 pt-3">
            <div className="flex h-8 items-center gap-2 rounded-lg border bg-plate px-2.5 transition-colors focus-within:border-cobalt">
              <SearchIcon size={14} className="text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                aria-label="Search guides"
                className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-3">
            <ViewRow
              active={view.type === "all"}
              onClick={() => setView({ type: "all" })}
              icon={
                <svg
                  className="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M3 9h18" />
                </svg>
              }
              label="All guides"
              count={counts.all}
            />
            <ViewRow
              active={view.type === "pinned"}
              onClick={() => setView({ type: "pinned" })}
              icon={<Star className="size-4" />}
              label="Pinned"
              count={counts.pinned}
            />
            <ViewRow
              active={view.type === "recent"}
              onClick={() => setView({ type: "recent" })}
              icon={<Clock className="size-4" />}
              label="Recent"
              newBadge={counts.recentNew}
            />

            <div className="mt-4 mb-1 flex items-center justify-between px-2.5">
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Folders
              </span>
              <button
                aria-label="New folder"
                onClick={() => setCreating(true)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Plus className="size-3.5" />
              </button>
            </div>

            {folders.map((f) => {
              const active = view.type === "folder" && view.id === f.id
              if (renaming === f.id) {
                return (
                  <input
                    key={f.id}
                    autoFocus
                    defaultValue={f.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v)
                        setFolders((fs) =>
                          fs.map((x) => (x.id === f.id ? { ...x, name: v } : x))
                        )
                      setRenaming(null)
                    }}
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
                  key={f.id}
                  className={cn(
                    "group flex items-center rounded-lg pr-1 transition-colors",
                    active ? "bg-cobalt-tint" : "hover:bg-muted"
                  )}
                >
                  <button
                    onClick={() => setView({ type: "folder", id: f.id })}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-[13px]",
                      active ? "font-medium text-cobalt-ink" : "text-foreground"
                    )}
                  >
                    {active ? (
                      <FolderOpen className="size-4 flex-none text-cobalt" />
                    ) : (
                      <Folder className="size-4 flex-none text-muted-foreground" />
                    )}
                    <span className="truncate">{f.name}</span>
                  </button>
                  <span className="mr-1 group-hover:hidden">
                    <FolderIndicators
                      hasNew={!!counts.fresh[f.id]}
                      reviewCount={counts.drafts[f.id] ?? 0}
                      total={counts.byFolder[f.id] ?? 0}
                      active={active}
                    />
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`${f.name} actions`}
                      className="hidden size-6 items-center justify-center rounded-md text-muted-foreground group-hover:flex hover:text-foreground"
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => setRenaming(f.id)}>
                        <SquarePenIcon size={15} />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => deleteFolder(f.id)}
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
              <div className="mt-0.5 flex items-center gap-1 px-0.5">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createFolder()
                    if (e.key === "Escape") {
                      setCreating(false)
                      setNewName("")
                    }
                  }}
                  placeholder="Folder name"
                  className="w-full rounded-lg border border-cobalt bg-plate px-2.5 py-1.5 text-[13px] outline-none"
                />
                <button
                  aria-label="Create"
                  onClick={createFolder}
                  className="flex size-7 flex-none items-center justify-center text-cobalt"
                >
                  <Check className="size-4" />
                </button>
                <button
                  aria-label="Cancel"
                  onClick={() => {
                    setCreating(false)
                    setNewName("")
                  }}
                  className="flex size-7 flex-none items-center justify-center text-muted-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}
          </div>

          <div className="border-t p-2">
            <button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-muted-foreground hover:bg-muted">
              <svg
                className="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M9.5 9a2.5 2.5 0 1 1 3 2.5c-.5.2-1 .7-1 1.5M12 17h.01" />
              </svg>
              Help &amp; resources
            </button>
          </div>
        </aside>
      </div>

      {/* ── Main: guides grid ─────────────────────────────────── */}
      <main className="mt-1.5 mr-1.5 mb-1.5 flex min-w-0 flex-1 flex-col overflow-hidden rounded-r-3xl border-t border-r border-b border-[var(--l-hairline)] bg-gradient-to-b from-[var(--l-content-a)] to-[var(--l-content-b)]">
        <header className="flex h-14 flex-none items-center justify-between gap-3 border-b border-[var(--l-hairline)] px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
              className="-ml-1 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
            >
              <Menu className="size-4" />
            </button>
            {view.type === "folder" ? (
              <FolderOpen className="size-4 flex-none text-muted-foreground" />
            ) : view.type === "pinned" ? (
              <Star className="size-4 flex-none text-muted-foreground" />
            ) : view.type === "recent" ? (
              <Clock className="size-4 flex-none text-muted-foreground" />
            ) : null}
            <h1 className="truncate text-[15px] font-semibold">{title}</h1>
            <span className="font-mono text-[11px] text-muted-foreground">
              {shown.length} guides
            </span>
          </div>
          <m.button
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 26 }}
            className="flex h-9 flex-none items-center gap-2 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-[#828fff]"
          >
            <Video className="size-4" />
            <span className="max-[380px]:hidden">New capture</span>
          </m.button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          <LibraryGreeting />
          <AnimatePresence mode="wait">
            {shown.length === 0 ? (
              <EmptyState
                key={`empty-${viewKey}`}
                className="mt-6"
                title={
                  query
                    ? "No guides match your search"
                    : `No guides in ${title} yet`
                }
                description={
                  query
                    ? "Try a different search term."
                    : "Record a workflow, or move an existing guide into this folder."
                }
              />
            ) : (
              <m.div
                key={viewKey}
                variants={gridV}
                initial="hidden"
                animate="show"
                exit="exit"
                className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              >
                {shown.map((guide) => (
                  <m.div key={guide.id} variants={staggerItem}>
                    <GuideCard guide={guide} />
                  </m.div>
                ))}
                {/* Add affordance — fills the trailing grid space so sparse
                    folders don't read as an unfinished page. */}
                <m.div key="__add" variants={staggerItem} className="h-full">
                  <button className="group/add flex h-full min-h-[230px] w-full flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-[var(--l-hairline-strong)] bg-[var(--l-placeholder)] text-muted-foreground transition-colors hover:border-[var(--l-hairline-strong)] hover:bg-[var(--l-placeholder-hover)] hover:text-foreground">
                    <span className="flex size-11 items-center justify-center rounded-full border border-[var(--l-hairline-strong)] bg-[var(--l-lift)] text-foreground transition-transform duration-200 group-hover/add:scale-105">
                      <Plus className="size-5" />
                    </span>
                    <span className="text-[13px] font-medium">New capture</span>
                    <span className="text-[11px] text-muted-foreground">
                      Record a workflow to add a guide
                    </span>
                  </button>
                </m.div>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
