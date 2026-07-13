"use client"

import * as React from "react"
import {
  AudioLines,
  Check,
  ChevronDown,
  Loader2,
  Mic2,
  Pause,
  Play,
  RotateCw,
  Sparkles,
  TriangleAlert,
  Wand2,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

import {
  TRANSLATION_LANGUAGES,
  voiceForLanguage,
  type GuideCustomization,
} from "@workspace/contracts/guide"
import {
  BASE_LANGUAGE,
  DEFAULT_VOICE_ID,
  VOICE_CATALOG,
  voiceOption,
} from "@workspace/contracts/voice"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

import { GeneratingState } from "@/components/generating-state"
import { api } from "@/lib/api"
import { useGuideTranslations } from "@/lib/guides"
import {
  useEditNarrationSegment,
  useGenerateAudio,
  useGenerateNarration,
  useNarration,
  useRegenerateNarrationSegment,
} from "@/lib/narration"

/**
 * Narration — the voiceover *script* review flow. Narration is generated from
 * each step of the guide (the spoken version of the on-screen text), and is the
 * canonical source of truth; audio is rendered from it later. Authors review
 * and edit each line here; a drifted step is flagged for re-narration.
 */
export function NarrationDialog({
  guideId,
  customization,
  onCustomizationChange,
  open,
  onOpenChange,
  onDirty,
}: {
  guideId: string
  /** The editor's working-copy customization (holds voice settings). */
  customization: GuideCustomization
  /** Stage a customization change (voice pick) into the editor. */
  onCustomizationChange: (next: GuideCustomization) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Mark the editor dirty — narration is part of the guide's saved content. */
  onDirty: () => void
}) {
  const [language, setLanguage] = React.useState(BASE_LANGUAGE)
  const { data: translations } = useGuideTranslations(guideId)
  const { data: narration, isLoading } = useNarration(guideId, language)
  const generate = useGenerateNarration(guideId, language)
  const genAudio = useGenerateAudio(guideId, language)
  const regenerate = useRegenerateNarrationSegment(guideId, language)
  const edit = useEditNarrationSegment(guideId, language)
  const [regenKey, setRegenKey] = React.useState<string | null>(null)

  // Base language + any languages the guide has been translated into.
  const languages = [
    BASE_LANGUAGE,
    ...(translations ?? []).map((t) => t.language),
  ]
  const langLabel = (code: string) =>
    code === BASE_LANGUAGE
      ? "English"
      : (TRANSLATION_LANGUAGES.find((l) => l.code === code)?.name ?? code)

  // Voice selection for the active language, stored in customization (saved with
  // the guide). Changing it re-hashes audio → segments show as needing a redo.
  const voiceSettings = customization.walkthroughView.voice
  const currentVoiceId =
    voiceForLanguage(voiceSettings, language) ?? DEFAULT_VOICE_ID
  const currentVoice = voiceOption(currentVoiceId)
  function setVoice(voiceId: string) {
    onDirty()
    onCustomizationChange({
      ...customization,
      walkthroughView: {
        ...customization.walkthroughView,
        voice: {
          ...voiceSettings,
          voiceByLanguage: {
            ...voiceSettings.voiceByLanguage,
            [language]: voiceId,
          },
        },
      },
    })
  }

  // Voice preview — audition a voice without committing. Cached server-side, so
  // the first play synthesizes (~2s, shows a spinner) and later plays are instant.
  const previewRef = React.useRef<HTMLAudioElement | null>(null)
  const [previewId, setPreviewId] = React.useState<string | null>(null)
  const [previewLoadingId, setPreviewLoadingId] = React.useState<string | null>(
    null
  )
  React.useEffect(() => () => previewRef.current?.pause(), [])
  async function previewVoice(voiceId: string) {
    previewRef.current?.pause()
    // Toggle off if this voice is already loading or playing.
    if (previewId === voiceId || previewLoadingId === voiceId) {
      setPreviewId(null)
      setPreviewLoadingId(null)
      return
    }
    setPreviewId(null)
    setPreviewLoadingId(voiceId)
    try {
      const { data } = await api.get<{ url: string }>(
        `/voices/${voiceId}/preview`
      )
      const el = new Audio(data.url)
      previewRef.current = el
      el.onended = () => setPreviewId((p) => (p === voiceId ? null : p))
      el.onpause = () => setPreviewId((p) => (p === voiceId ? null : p))
      await el.play()
      setPreviewLoadingId(null)
      setPreviewId(voiceId)
    } catch {
      setPreviewLoadingId(null)
      setPreviewId(null)
      toast.error("Couldn't preview that voice")
    }
  }

  const items = narration?.items ?? []
  const generated = narration?.generated ?? false
  const generating = narration?.status === "generating"
  const failed = narration?.status === "failed"
  const audio = narration?.audio
  const audioRendering = audio?.status === "generating"
  const audioTotal = audio?.total ?? 0
  const audioUpToDate = audio?.upToDate ?? 0
  const hasAudio = (audio?.ready ?? 0) > 0
  // Some steps' audio doesn't match the current voice/text yet → an update is
  // actually pending. When everything's current, there's nothing to update.
  const audioNeedsUpdate = audioTotal > 0 && audioUpToDate < audioTotal
  const audioAllCurrent = audioTotal > 0 && audioUpToDate === audioTotal
  const staleCount = narration?.staleness.staleAnchors.length ?? 0
  const missingCount = narration?.staleness.missingAnchors.length ?? 0

  function generateVoiceover() {
    onDirty()
    genAudio.mutate(undefined, {
      onSuccess: () => toast.success("Rendering voiceover…"),
      onError: () => toast.error("Couldn't start the voiceover"),
    })
  }

  function generateAll(force: boolean) {
    onDirty()
    generate.mutate(
      { force },
      {
        onSuccess: () => toast.success("Generating narration…"),
        onError: () => toast.error("Couldn't start narration"),
      }
    )
  }

  function regenerateOne(anchorKey: string) {
    setRegenKey(anchorKey)
    onDirty()
    regenerate.mutate(anchorKey, {
      onSuccess: () => toast.success("Step re-narrated"),
      onError: () => toast.error("Couldn't re-narrate that step"),
      onSettled: () => setRegenKey(null),
    })
  }

  function commitEdit(anchorKey: string, text: string, previous: string | null) {
    if (text === (previous ?? "")) return
    onDirty()
    edit.mutate({ anchorKey, text })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] flex-col gap-0 p-0 sm:max-w-4xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-lg">
              <Wand2 className="size-4" />
            </span>
            Narration
          </DialogTitle>
        </DialogHeader>

        {/* Language selector — base + translated languages */}
        {languages.length > 1 && (
          <div className="bg-card flex flex-wrap items-center gap-2 border-b px-6 py-2.5">
            <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Language
            </span>
            {languages.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLanguage(code)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                  language === code
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-foreground/70 hover:bg-muted border-transparent"
                )}
              >
                {langLabel(code)}
              </button>
            ))}
          </div>
        )}

        {/* Action bar */}
        <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
          <p className="text-muted-foreground text-xs">
            The spoken script for your walkthrough, generated from each step.
            Edit any line — audio is rendered from this script.
          </p>
          <div className="flex items-center gap-2">
            <VoicePicker
              value={currentVoiceId}
              onChange={setVoice}
              previewId={previewId}
              previewLoadingId={previewLoadingId}
              onPreview={previewVoice}
            />
            {currentVoice && (
              <span className="text-muted-foreground hidden text-xs sm:inline">
                {currentVoice.accent}
              </span>
            )}
            {generated && (staleCount > 0 || missingCount > 0) && (
              <span className="rounded bg-orange-500/15 px-2 py-1 text-[11px] font-medium text-orange-600 dark:text-orange-400">
                {staleCount + missingCount} step
                {staleCount + missingCount > 1 ? "s" : ""} need narration
              </span>
            )}
            {/* Narration script — write/rewrite the spoken text for every step */}
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex" />}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generateAll(generated)}
                  disabled={generate.isPending || generating || items.length === 0}
                >
                  {generate.isPending || generating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {generated ? "Regenerate all" : "Generate narration"}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-56">
                {generated
                  ? "Rewrite the spoken script for every step from the current guide text (keeps steps you edited by hand)."
                  : "Write the spoken script for every step from the guide text."}
              </TooltipContent>
            </Tooltip>

            {/* Voiceover audio — render the script into speech */}
            {generated && (
              <Tooltip>
                <TooltipTrigger render={<span className="inline-flex" />}>
                  <Button
                    size="sm"
                    onClick={generateVoiceover}
                    disabled={
                      genAudio.isPending ||
                      audioRendering ||
                      generating ||
                      audioAllCurrent
                    }
                  >
                    {genAudio.isPending || audioRendering ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : audioAllCurrent ? (
                      <Check className="size-4" />
                    ) : (
                      <AudioLines className="size-4" />
                    )}
                    {audioRendering
                      ? `Rendering ${audioUpToDate}/${audioTotal}`
                      : !hasAudio
                        ? "Generate voiceover"
                        : audioNeedsUpdate
                          ? "Update voiceover"
                          : "Voiceover ready"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-56">
                  {audioRendering
                    ? "Rendering the audio on the worker…"
                    : !hasAudio
                      ? "Turn the narration script into spoken audio."
                      : audioNeedsUpdate
                        ? "Re-render audio for steps whose text or voice changed."
                        : "Every step has up-to-date audio for this voice."}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Review list */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
          {generating ? (
            <GeneratingState
              variant="voice"
              title="Writing your narration…"
              subtitle="Turning each step into a natural spoken script."
            />
          ) : isLoading ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Loading…
            </p>
          ) : failed ? (
            <div className="space-y-3 py-12 text-center">
              <p className="text-destructive text-sm">
                Narration generation failed. Please try again.
              </p>
              <Button size="sm" variant="outline" onClick={() => generateAll(true)}>
                Retry
              </Button>
            </div>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center text-sm">
              This guide has no steps to narrate yet.
            </p>
          ) : (
            items.map((item) => {
              const busy = regenKey === item.anchorKey && regenerate.isPending
              return (
                <div
                  key={item.anchorKey}
                  className={cn(
                    "overflow-hidden rounded-xl border",
                    item.stale && "border-orange-400/50"
                  )}
                >
                  <div className="bg-muted/40 flex items-center justify-between gap-2 border-b px-4 py-2">
                    <span className="text-muted-foreground text-[11px] font-semibold tracking-widest uppercase">
                      {item.label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <AudioBadge
                        status={item.audioStatus}
                        url={item.audioUrl}
                      />
                      {item.humanEdited && (
                        <span className="text-muted-foreground rounded bg-foreground/5 px-1.5 py-0.5 text-[10px] font-medium">
                          Edited
                        </span>
                      )}
                      {item.stale && (
                        <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-medium text-orange-600 dark:text-orange-400">
                          Step changed
                        </span>
                      )}
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              aria-label="Re-narrate this step"
                              disabled={regenerate.isPending || generate.isPending}
                              onClick={() => regenerateOne(item.anchorKey)}
                              className="text-muted-foreground hover:text-foreground disabled:opacity-40"
                            />
                          }
                        >
                          {busy ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <RotateCw className="size-3.5" />
                          )}
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          Re-narrate from the current step text
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    {/* On-screen source */}
                    <p className="bg-muted/40 text-muted-foreground rounded-lg px-3 py-2 text-xs [overflow-wrap:anywhere]">
                      {item.source || "(no on-screen text)"}
                    </p>
                    {/* Editable narration */}
                    <NarrationField
                      key={`${item.anchorKey}:${item.text ?? ""}`}
                      value={item.text}
                      busy={busy}
                      onCommit={(text) =>
                        commitEdit(item.anchorKey, text, item.text)
                      }
                    />
                    {item.stale && (
                      <p className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                        <RotateCw className="size-3" />
                        The step text changed since this was written —
                        re-narrate to update it.
                      </p>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
          <p className="text-muted-foreground text-xs">
            Narration is saved with the guide and goes live when you{" "}
            <span className="font-medium">Update guide</span>.
          </p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Blur-committed narration editor for one segment. */
function NarrationField({
  value,
  busy,
  onCommit,
}: {
  value: string | null
  busy: boolean
  onCommit: (text: string) => void
}) {
  if (value == null && !busy) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-3 text-sm italic">
        Not generated yet — use Generate narration above.
      </p>
    )
  }
  return (
    <textarea
      defaultValue={value ?? ""}
      rows={2}
      disabled={busy}
      placeholder={busy ? "Writing…" : "Narration for this step…"}
      onBlur={(e) => onCommit(e.target.value)}
      className={cn(
        "border-input focus-visible:ring-ring/40 w-full resize-none rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none [field-sizing:content] focus-visible:ring-2",
        busy && "opacity-60"
      )}
    />
  )
}

/** Voice dropdown — the catalog grouped by accent (Indian first), with a
 *  per-voice ▶ preview so authors can audition before committing. */
function VoicePicker({
  value,
  onChange,
  previewId,
  previewLoadingId,
  onPreview,
}: {
  value: string
  onChange: (voiceId: string) => void
  previewId: string | null
  previewLoadingId: string | null
  onPreview: (voiceId: string) => void
}) {
  const current = voiceOption(value)
  const groups = ["Indian", "American", "British", "Australian"] as const
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Choose voice"
            className="border-input hover:bg-muted inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors"
          />
        }
      >
        <Mic2 className="text-muted-foreground size-4" />
        <span className="max-w-28 truncate">{current?.name ?? "Voice"}</span>
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 w-72 overflow-y-auto">
        {groups.map((group) => (
          <DropdownMenuGroup key={group}>
            <DropdownMenuLabel className="text-muted-foreground text-[11px] tracking-wide uppercase">
              {group}
            </DropdownMenuLabel>
            {VOICE_CATALOG.filter((v) => v.accent === group).map((v) => (
              <DropdownMenuItem
                key={v.id}
                onClick={() => onChange(v.id)}
                className="flex items-center gap-2"
              >
                {/* Preview — click to hear without selecting (keeps menu open). */}
                <button
                  type="button"
                  aria-label={`Preview ${v.name}`}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onPreview(v.id)
                  }}
                  className="text-primary hover:bg-primary/10 grid size-7 shrink-0 place-items-center rounded-md transition-colors"
                >
                  {previewLoadingId === v.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : previewId === v.id ? (
                    <Pause className="size-3.5" />
                  ) : (
                    <Play className="size-3.5" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    {v.name}
                    <span className="text-muted-foreground text-[10px] font-normal capitalize">
                      · {v.gender}
                    </span>
                  </div>
                  <div className="text-muted-foreground truncate text-xs">
                    {v.description}
                  </div>
                </div>
                {v.id === value && (
                  <Check className="text-primary size-4 shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Per-segment audio state: play/pause a ready render, or show progress. */
function AudioBadge({
  status,
  url,
}: {
  status: "none" | "pending" | "ready" | "failed"
  url: string | null
}) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = React.useState(false)

  React.useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  if (status === "pending") {
    return (
      <span className="text-muted-foreground flex items-center gap-1 text-[10px] font-medium">
        <Loader2 className="size-3 animate-spin" /> Rendering
      </span>
    )
  }
  if (status === "failed") {
    return (
      <Tooltip>
        <TooltipTrigger
          render={<span className="text-destructive flex items-center" />}
        >
          <TriangleAlert className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent side="top">Audio failed — try again</TooltipContent>
      </Tooltip>
    )
  }
  if (status !== "ready" || !url) return null

  function toggle() {
    if (!audioRef.current) {
      const el = new Audio(url!)
      el.onended = () => setPlaying(false)
      el.onpause = () => setPlaying(false)
      audioRef.current = el
    }
    const el = audioRef.current
    if (playing) {
      el.pause()
      setPlaying(false)
    } else {
      void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={playing ? "Pause preview" : "Play preview"}
            onClick={toggle}
            className="text-primary hover:bg-primary/10 grid size-6 place-items-center rounded-md transition-colors"
          />
        }
      >
        {playing ? (
          <Pause className="size-3.5" />
        ) : (
          <Play className="size-3.5" />
        )}
      </TooltipTrigger>
      <TooltipContent side="top">
        {playing ? "Pause" : "Play voiceover"}
      </TooltipContent>
    </Tooltip>
  )
}
