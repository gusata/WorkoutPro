'use client'

import { useId } from 'react'

export interface LinePoint {
  date: Date
  value: number
}

/**
 * Minimal line chart: soft area, 2px line, last point emphasized, optional dashed
 * trend line. Values are summarized for assistive tech by the caller.
 */
export function LineChart({ points, trend, height = 160, format, label }: {
  points: LinePoint[]
  trend?: { from: number; to: number } | null
  height?: number
  format: (value: number) => string
  label: string
}) {
  const gradientId = useId()
  const width = 320
  const pad = { top: 16, bottom: 8, left: 0, right: 8 }
  if (points.length === 0) return null
  const values = points.map((point) => point.value).concat(trend ? [trend.from, trend.to] : [])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(max - min, max * 0.05, 1)
  const lo = min - range * 0.15
  const hi = max + range * 0.15
  const first = points[0].date.getTime()
  const span = Math.max(points[points.length - 1].date.getTime() - first, 1)
  const x = (date: Date) => pad.left + ((date.getTime() - first) / span) * (width - pad.left - pad.right)
  const y = (value: number) => pad.top + (1 - (value - lo) / (hi - lo)) * (height - pad.top - pad.bottom)
  const single = points.length === 1
  const coords = points.map((point) => [single ? width / 2 : x(point.date), y(point.value)] as const)
  const line = coords.map(([px, py], index) => `${index === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
  const area = `${line} L${coords.at(-1)![0].toFixed(1)},${height} L${coords[0][0].toFixed(1)},${height} Z`
  const last = coords.at(-1)!

  return (
    <figure>
      <figcaption className="sr-only">{label}</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--data-1)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--data-1)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line key={ratio} x1={0} x2={width} y1={pad.top + ratio * (height - pad.top - pad.bottom)} y2={pad.top + ratio * (height - pad.top - pad.bottom)} stroke="var(--separator)" strokeWidth={0.5} />
        ))}
        {!single && <path d={area} fill={`url(#${gradientId})`} />}
        {trend && !single && (
          <line x1={x(points[0].date)} x2={x(points[points.length - 1].date)} y1={y(trend.from)} y2={y(trend.to)} stroke="var(--muted)" strokeWidth={1.25} strokeDasharray="4 4" />
        )}
        {!single && <path d={line} fill="none" stroke="var(--data-1)" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />}
        <circle cx={last[0]} cy={last[1]} r={5} fill="var(--data-1)" stroke="var(--surface)" strokeWidth={2.5} />
        <text x={Math.min(last[0], width - 4)} y={Math.max(last[1] - 12, 12)} textAnchor="end" fontSize="12" fontWeight="600" fill="var(--foreground)">{format(points.at(-1)!.value)}</text>
      </svg>
    </figure>
  )
}
