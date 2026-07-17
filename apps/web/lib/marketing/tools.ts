import { Film, FileText, MonitorPlay, PenTool, QrCode, ScrollText, type LucideIcon } from "lucide-react"

export type Tool = {
  slug: string
  name: string
  tagline: string
  description: string
  icon: LucideIcon
  /** false = a funnel/landing page rather than an in-browser tool. */
  interactive: boolean
}

export const TOOLS: Tool[] = [
  {
    slug: "screenshot-annotator",
    name: "Screenshot annotator",
    tagline: "Add boxes, arrows, text, and blur to any screenshot — in your browser.",
    description:
      "Free online screenshot annotator. Upload an image and add rectangles, arrows, text, and blur, then download it. Nothing leaves your device.",
    icon: PenTool,
    interactive: true,
  },
  {
    slug: "screen-recorder",
    name: "Screen recorder",
    tagline: "Record your screen right in the browser. No install, no watermark.",
    description:
      "Free online screen recorder. Capture a tab, window, or your whole screen with audio and download the clip — all locally in your browser.",
    icon: MonitorPlay,
    interactive: true,
  },
  {
    slug: "gif-maker",
    name: "GIF maker",
    tagline: "Record your screen and export a shareable animated GIF.",
    description:
      "Free online GIF maker. Record a region of your screen and export an optimized animated GIF, right in your browser — nothing is uploaded.",
    icon: Film,
    interactive: true,
  },
  {
    slug: "qr-code-generator",
    name: "QR code generator",
    tagline: "Make a custom QR code for any link or text and download it.",
    description:
      "Free QR code generator. Turn any URL or text into a high-resolution QR code with custom colors, and download it as a PNG.",
    icon: QrCode,
    interactive: true,
  },
  {
    slug: "sop-creator",
    name: "SOP creator",
    tagline: "Turn a process into a clean, formatted standard operating procedure.",
    description:
      "Free SOP creator. Fill in the purpose, scope, and steps and get a clean, formatted standard operating procedure you can copy or download as Markdown.",
    icon: ScrollText,
    interactive: true,
  },
  {
    slug: "step-by-step-guide-maker",
    name: "Step-by-step guide maker",
    tagline: "Record a workflow once and get a polished step-by-step guide, free.",
    description:
      "Free step-by-step guide maker. Record any browser workflow and Tacto's AI writes a clear, screenshot-by-screenshot guide automatically.",
    icon: FileText,
    interactive: false,
  },
]

export function getTool(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug)
}
