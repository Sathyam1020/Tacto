"use client"

import * as React from "react"
import { Check, ChevronDown, Languages } from "lucide-react"
import { DownloadIcon } from "@workspace/ui/components/download"

import {
  applyPresentationTranslation,
  EMPTY_PRESENTATION,
  readTranslationSteps,
  RTL_LANGUAGE_CODES,
  TRANSLATION_LANGUAGES,
} from "@workspace/contracts/guide"
import { BASE_LANGUAGE } from "@workspace/contracts/voice"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { LogoMark } from "@workspace/ui/components/logo"
import { cn } from "@workspace/ui/lib/utils"

import { layoutMaxWidthClass } from "@/components/guide-customization-context"
import { FormEmbedOverlay } from "@/components/form-embed-overlay"
import { GuideFaqs } from "@/components/guide-faqs"
import { GuideFeedback } from "@/components/guide-feedback"
import { GuideBody, ViewModeToggle, type ViewMode } from "@/components/guide-view"
import { guideFontFamily } from "@/lib/guide-fonts"
import {
  GuideAnalyticsProvider,
  useGuideTracker,
} from "@/lib/guide-tracker"
import { resolveCustomization } from "@/lib/guides"
import { downloadGuidePdf } from "@/lib/pdf"
import type { PublicGuide } from "@/lib/public-guide"

/**
 * Public guide reader — a standalone editorial page (no app chrome). This is
 * also marketing: every shared guide shows the Tacto mark.
 */
export function PublicGuideView({
  guide,
  embedded = false,
  chromeless = false,
  mode: modeProp,
  onModeChange,
  lang: langProp,
  onLangChange,
  stepVariant,
}: {
  guide: PublicGuide
  /** Rendered inside another page's chrome (e.g. a Help Center) — hides the
   *  guide's standalone header/footer and floats the reader controls instead. */
  embedded?: boolean
  /** Like `embedded`, but renders NO controls — the parent provides them and
   *  drives mode/lang (controlled). Used by the Help Center navbar. */
  chromeless?: boolean
  mode?: ViewMode
  onModeChange?: (mode: ViewMode) => void
  lang?: string | null
  onLangChange?: (lang: string | null) => void
  /** "cards" wraps each list step in a bordered card (Help Center look). */
  stepVariant?: "cards"
}) {
  const cust = React.useMemo(
    () => resolveCustomization(guide.customization),
    [guide.customization]
  )
  const dv = cust.general.defaultView
  const lockedMode: ViewMode | null =
    dv === "only-scroll" ? "list" : dv === "only-walkthrough" ? "interactive" : null
  const modeControlled = modeProp !== undefined
  const [internalMode, setInternalMode] = React.useState<ViewMode>(
    dv === "walkthrough-default" || dv === "only-walkthrough"
      ? "interactive"
      : "list"
  )
  const selectedMode = modeControlled ? modeProp! : internalMode
  const effectiveMode = lockedMode ?? selectedMode
  const width = layoutMaxWidthClass(cust.general.pageLayout)
  const stepCount = guide.blocks.filter((b) => b.type === "STEP").length

  // Language switcher — overlay a translation's text onto the base blocks
  // (screenshots/layout are language-independent). null = original.
  const langControlled = langProp !== undefined
  const [internalLang, setInternalLang] = React.useState<string | null>(null)
  const lang = langControlled ? (langProp ?? null) : internalLang
  const translations = guide.translations ?? []
  const activeT = lang
    ? (translations.find((t) => t.language === lang) ?? null)
    : null
  const displayBlocks = React.useMemo(() => {
    if (!activeT) return guide.blocks
    // Key-based overlay: match translated content to each block by its stable
    // key, so reordered/inserted/deleted steps never misalign. Legacy (index)
    // translations are migrated on read against the current block order.
    const map = readTranslationSteps(
      activeT.steps,
      guide.blocks.map((b) => b.key)
    )
    return guide.blocks.map((b) => ({ ...b, content: map[b.key] ?? b.content }))
  }, [activeT, guide.blocks])
  // Interactive step callouts come from the (already-translated) List blocks —
  // global by construction. Only the slides (title/subtitle/buttons) need the
  // key-addressed interactive translation overlaid onto the presentation.
  const displayInteractive = React.useMemo(() => {
    const pres = guide.interactive ?? EMPTY_PRESENTATION
    if (!activeT?.interactive) return pres
    return applyPresentationTranslation(pres, activeT.interactive)
  }, [activeT, guide.interactive])
  const displayTitle = activeT?.title ?? guide.title
  const displaySummary = activeT ? activeT.summary : guide.summary
  const isRtl =
    cust.brand.rtl ||
    (lang ? (RTL_LANGUAGE_CODES as readonly string[]).includes(lang) : false)

  // ── Analytics ──────────────────────────────────────────────────────────────
  const tracker = useGuideTracker(guide.shareId)
  const { track } = tracker
  const started = React.useRef(false)

  // Count one view per session.
  React.useEffect(() => {
    if (started.current) return
    started.current = true
    track("view")
  }, [track])
  // Track reading mode + language whenever they change (deduped by the tracker,
  // so this works whether mode/lang are controlled by a parent or internal).
  React.useEffect(() => {
    track("mode_switch", { mode: effectiveMode })
  }, [effectiveMode, track])
  React.useEffect(() => {
    if (lang) track("language_switch", { language: lang })
  }, [lang, track])

  const changeMode = React.useCallback(
    (next: ViewMode) => {
      if (modeControlled) onModeChange?.(next)
      else setInternalMode(next)
    },
    [modeControlled, onModeChange]
  )
  const changeLang = React.useCallback(
    (next: string | null) => {
      if (langControlled) onLangChange?.(next)
      else setInternalLang(next)
    },
    [langControlled, onLangChange]
  )

  // Scroll-mode completion: require reading ≥80% of steps AND the final step, so
  // a fast scroll-to-bottom doesn't inflate completion (walkthrough completion
  // is handled inside InteractiveView by reaching the last frame).
  React.useEffect(() => {
    if (effectiveMode !== "list") return
    const stepKeys = displayBlocks
      .filter((b) => b.type === "STEP")
      .map((b) => b.key)
    const total = stepKeys.length
    if (total === 0) return
    const lastKey = stepKeys[total - 1]
    const seen = new Set<string>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const key = (e.target as HTMLElement).dataset.stepKey
          if (key) seen.add(key)
        }
        if (seen.size / total >= 0.8 && lastKey && seen.has(lastKey)) {
          track("complete")
          io.disconnect()
        }
      },
      { threshold: 0.6 }
    )
    const observeAll = () => {
      for (const key of stepKeys) {
        const el = document.querySelector(`[data-step-key="${key}"]`)
        if (el) io.observe(el)
      }
    }
    observeAll()
    // Steps may mount just after this effect (view switch) — retry once.
    const t = setTimeout(observeAll, 400)
    return () => {
      clearTimeout(t)
      io.disconnect()
    }
  }, [effectiveMode, displayBlocks, track])

  const controls = (
    <div className="flex items-center gap-2">
      {translations.length > 0 && (
        <LanguageSwitcher
          translations={translations}
          value={lang}
          onChange={changeLang}
        />
      )}
      {!lockedMode && <ViewModeToggle mode={selectedMode} onChange={changeMode} />}
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          track("pdf_download")
          void downloadGuidePdf({
            title: displayTitle,
            summary: displaySummary,
            blocks: displayBlocks,
            customization: guide.customization,
          })
        }}
      >
        <DownloadIcon size={15} />
        PDF
      </Button>
    </div>
  )

  return (
    <GuideAnalyticsProvider tracker={tracker}>
    <div
      className={embedded || chromeless ? undefined : "min-h-svh"}
      dir={isRtl ? "rtl" : undefined}
      style={
        {
          ["--primary" as string]: cust.brand.color,
          fontFamily: guideFontFamily(cust.brand.font),
        } as React.CSSProperties
      }
    >
      {!embedded && !chromeless && (
        <header className="border-b">
          <div className={cn("mx-auto flex h-14 items-center justify-between px-6", width)}>
            {cust.brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cust.brand.logoUrl}
                alt={guide.workspaceName}
                className="h-6 w-auto max-w-[180px] object-contain"
              />
            ) : (
              <div className="flex items-center gap-2">
                <LogoMark className="size-5" />
                <span className="text-muted-foreground font-mono text-xs">
                  {guide.workspaceName}
                </span>
              </div>
            )}
            {controls}
          </div>
        </header>
      )}

      <main className={cn("mx-auto px-6", embedded || chromeless ? "pt-6 pb-14" : "py-14", width)}>
        {embedded && !chromeless && <div className="mb-6 flex justify-end">{controls}</div>}
        <h1 className="font-serif text-4xl font-medium leading-tight tracking-tight text-balance">
          {displayTitle}
        </h1>
        {displaySummary && (
          <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
            {displaySummary}
          </p>
        )}
        <p className="text-muted-foreground mt-4 border-b pb-6 font-mono text-xs">
          {stepCount} steps
        </p>

        <div className="mt-10">
          <GuideBody
            blocks={displayBlocks}
            interactive={displayInteractive}
            narration={guide.narration[lang ?? BASE_LANGUAGE] ?? {}}
            mode={effectiveMode}
            customization={cust}
            variant={stepVariant}
          />
        </div>

        <GuideFaqs faqs={guide.faqs} />

        {guide.embeds.map((embed) => (
          <FormEmbedOverlay key={embed.id} embed={embed} guideId={guide.shareId} />
        ))}

        <GuideFeedback
          shareId={guide.shareId}
          allowReactions={cust.feedback.allowReactions}
          allowComments={cust.feedback.allowComments}
          initialReactions={guide.reactions}
          initialComments={guide.comments}
        />

        {!embedded && !chromeless && (
        <footer className="mt-20 border-t pt-8 text-center">
          <a
            href="/"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 font-mono text-xs transition-colors"
          >
            <LogoMark className="size-4" />
            Made with Tacto
          </a>
        </footer>
        )}
      </main>
    </div>
    </GuideAnalyticsProvider>
  )
}

const LANG_NAME = new Map<string, string>(
  TRANSLATION_LANGUAGES.map((l) => [l.code, l.name])
)

/** Original + available translated languages. */
export function LanguageSwitcher({
  translations,
  value,
  onChange,
}: {
  translations: { language: string }[]
  value: string | null
  onChange: (lang: string | null) => void
}) {
  const label = value ? (LANG_NAME.get(value) ?? value) : "Original"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
        <Languages size={15} />
        <span className="max-sm:hidden">{label}</span>
        <ChevronDown className="size-4 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
        <DropdownMenuItem onClick={() => onChange(null)}>
          <span className="flex-1">Original</span>
          {value === null && <Check className="text-primary size-4" />}
        </DropdownMenuItem>
        {translations.map((t) => (
          <DropdownMenuItem
            key={t.language}
            onClick={() => onChange(t.language)}
          >
            <span className="flex-1">
              {LANG_NAME.get(t.language) ?? t.language}
            </span>
            {value === t.language && <Check className="text-primary size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
