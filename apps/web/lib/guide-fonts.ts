import {
  DM_Sans,
  Geist,
  Inter,
  Lato,
  Montserrat,
  Open_Sans,
  Poppins,
  Roboto,
} from "next/font/google"

import type { GuideFont } from "@workspace/contracts/guide"

/**
 * The curated brand fonts a guide can be published in. All are loaded with
 * `preload: false` so a font is only fetched when a guide actually selects it
 * — the 7 non-default families never touch pages that don't use them.
 */
const dmSans = DM_Sans({ subsets: ["latin"], display: "swap", preload: false })
const geist = Geist({ subsets: ["latin"], display: "swap", preload: false })
const inter = Inter({ subsets: ["latin"], display: "swap", preload: false })
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false,
})
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
})
const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  preload: false,
})
const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  preload: false,
})
const openSans = Open_Sans({
  subsets: ["latin"],
  display: "swap",
  preload: false,
})

const FONTS: Record<GuideFont, { style: { fontFamily: string } }> = {
  "DM Sans": dmSans,
  Geist: geist,
  Inter: inter,
  Roboto: roboto,
  Poppins: poppins,
  Montserrat: montserrat,
  Lato: lato,
  "Open Sans": openSans,
}

/** The CSS `font-family` string for a guide's selected brand font. */
export function guideFontFamily(font: GuideFont): string {
  return (FONTS[font] ?? geist).style.fontFamily
}
