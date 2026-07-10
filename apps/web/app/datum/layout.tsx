import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import "./datum.css"

// The real production faces for Datum — Geist (UI) + Geist Mono (data).
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const metadata: Metadata = {
  title: "Datum — Tacto Visual Language",
}

export default function DatumLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={`${geist.variable} ${geistMono.variable} datum`}>
      {children}
    </div>
  )
}
