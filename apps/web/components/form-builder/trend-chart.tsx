"use client"

import * as React from "react"

/**
 * A dependency-free SVG area chart for a daily series. Theme-aware via
 * currentColor + the primary token; responsive via a viewBox.
 */
export function TrendChart({
  data,
  height = 200,
}: {
  data: { date: string; count: number }[]
  height?: number
}) {
  const [hover, setHover] = React.useState<number | null>(null)
  const W = 720
  const H = height
  const pad = { top: 12, right: 12, bottom: 22, left: 28 }
  const iw = W - pad.left - pad.right
  const ih = H - pad.top - pad.bottom

  const max = Math.max(1, ...data.map((d) => d.count))
  const n = data.length
  const x = (i: number) => pad.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw)
  const y = (v: number) => pad.top + ih - (v / max) * ih

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.count)}`).join(" ")
  const area = `${line} L${x(n - 1)},${pad.top + ih} L${x(0)},${pad.top + ih} Z`

  // ~5 evenly spaced date ticks.
  const tickEvery = Math.max(1, Math.ceil(n / 6))

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full text-primary"
        preserveAspectRatio="none"
        role="img"
        aria-label="Submissions over time"
      >
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* horizontal gridlines */}
        {[0, 0.5, 1].map((t) => (
          <line
            key={t}
            x1={pad.left}
            x2={W - pad.right}
            y1={pad.top + ih * t}
            y2={pad.top + ih * t}
            className="stroke-border"
            strokeWidth="1"
          />
        ))}

        <path d={area} fill="url(#trend-fill)" />
        <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />

        {/* hover markers */}
        {data.map((d, i) => (
          <g key={i}>
            <rect
              x={x(i) - iw / (2 * Math.max(1, n))}
              y={pad.top}
              width={iw / Math.max(1, n)}
              height={ih}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
            {hover === i && (
              <>
                <circle cx={x(i)} cy={y(d.count)} r="3.5" fill="currentColor" />
                <text
                  x={x(i)}
                  y={y(d.count) - 8}
                  textAnchor="middle"
                  className="fill-foreground text-[11px] font-medium"
                >
                  {d.count}
                </text>
              </>
            )}
          </g>
        ))}

        {/* y max label */}
        <text x={pad.left - 6} y={pad.top + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
          {max}
        </text>

        {/* x date ticks */}
        {data.map((d, i) =>
          i % tickEvery === 0 ? (
            <text
              key={d.date}
              x={x(i)}
              y={H - 6}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {d.date.slice(5)}
            </text>
          ) : null
        )}
      </svg>
    </div>
  )
}
