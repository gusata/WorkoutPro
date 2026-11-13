'use client'

import { format } from 'date-fns'
import type { SleepNight, SleepStageName } from '@/lib/health'

export const STAGE_STYLE: Record<SleepStageName, { label: string; color: string; row: number }> = {
  awake: { label: 'Acordado', color: '#ff9f0a', row: 0 },
  rem: { label: 'REM', color: '#5ac8fa', row: 1 },
  light: { label: 'Leve', color: '#0a84ff', row: 2 },
  asleep: { label: 'Dormindo', color: '#0a84ff', row: 2 },
  deep: { label: 'Profundo', color: '#5e5ce6', row: 3 },
}

/** Sleep stages over the night, Apple-Health style: one lane per stage. */
export function Hypnogram({ night, compact = false }: { night: SleepNight; compact?: boolean }) {
  const start = night.start.getTime()
  const span = Math.max(night.end.getTime() - start, 1)
  const width = 320
  const laneHeight = compact ? 12 : 18
  const gap = compact ? 6 : 8
  const height = 4 * laneHeight + 3 * gap
  const stages = night.hasStages ? night.stages : [{ start: night.start, end: night.end, stage: 'asleep' as SleepStageName }]
  const summary = night.hasStages
    ? (['deep', 'light', 'rem', 'awake'] as SleepStageName[]).map((stage) => `${STAGE_STYLE[stage].label} ${night.minutes[stage]} min`).join(', ')
    : `${night.asleep} minutos dormindo`
  return (
    <figure>
      <figcaption className="sr-only">Estágios do sono de {format(night.start, 'HH:mm')} a {format(night.end, 'HH:mm')}: {summary}.</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden>
        {[0, 1, 2, 3].map((row) => (
          <rect key={row} x={0} y={row * (laneHeight + gap)} width={width} height={laneHeight} rx={laneHeight / 2} fill="var(--fill)" />
        ))}
        {stages.map((stage, index) => {
          const style = STAGE_STYLE[stage.stage]
          const x = ((stage.start.getTime() - start) / span) * width
          const w = Math.max(1.5, ((stage.end.getTime() - stage.start.getTime()) / span) * width)
          return <rect key={index} x={x} y={style.row * (laneHeight + gap)} width={w} height={laneHeight} rx={Math.min(4, w / 2)} fill={style.color} />
        })}
      </svg>
      {!compact && (
        <div aria-hidden className="caption mt-2 flex justify-between text-[var(--muted)]">
          <span>{format(night.start, 'HH:mm')}</span>
          <span>{format(night.end, 'HH:mm')}</span>
        </div>
      )}
    </figure>
  )
}

export function StageLegend({ night }: { night: SleepNight }) {
  if (!night.hasStages) return null
  return (
    <dl className="grid grid-cols-4 gap-2">
      {(['awake', 'rem', 'light', 'deep'] as SleepStageName[]).map((stage) => (
        <div key={stage}>
          <dt className="caption flex items-center gap-1.5 text-[var(--muted)]"><span aria-hidden className="h-2 w-2 rounded-full" style={{ background: STAGE_STYLE[stage].color }} />{STAGE_STYLE[stage].label}</dt>
          <dd className="headline numeric mt-0.5">{formatHm(night.minutes[stage])}</dd>
        </div>
      ))}
    </dl>
  )
}

export function formatHm(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}` : `${m} min`
}

/** Circular score (0–100) with the number in the middle. */
export function ScoreRing({ score, size = 132, label }: { score: number; size?: number; label: string }) {
  const stroke = size * 0.09
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const color = score >= 75 ? 'var(--success-fill)' : score >= 55 ? 'var(--accent-fill)' : '#ff9f0a'
  return (
    <div className="relative flex-none" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--fill-strong)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={circumference * (1 - score / 100)}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(.25,.1,.25,1)' }}
        />
      </svg>
      <span aria-hidden className="stat absolute inset-0 flex items-center justify-center" style={{ fontSize: size * 0.3 }}>{score}</span>
    </div>
  )
}

/** Small vertical bars (steps, sleep per night). The last bar is highlighted. */
export function MiniBars({ data, goal, format: formatValue, height = 96 }: {
  data: Array<{ label: string; value: number }>
  goal?: number
  format: (value: number) => string
  height?: number
}) {
  const max = Math.max(1, goal ?? 0, ...data.map((item) => item.value))
  return (
    <figure>
      <figcaption className="sr-only">{data.map((item) => `${item.label}: ${formatValue(item.value)}`).join('; ')}</figcaption>
      <div aria-hidden className="relative" style={{ height }}>
        {goal ? <div className="absolute left-0 right-0 border-t border-dashed border-[var(--muted)] opacity-50" style={{ bottom: `${(goal / max) * 100}%` }} /> : null}
        <div className="relative grid h-full items-end gap-1.5" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
          {data.map((item, index) => (
            <div key={`${item.label}-${index}`} className="flex h-full items-end justify-center">
              <div
                className="w-full max-w-5 rounded-[4px]"
                style={{
                  height: `${item.value > 0 ? Math.max((item.value / max) * 100, 3) : 0}%`,
                  background: index === data.length - 1 ? 'var(--data-1)' : 'color-mix(in srgb, var(--data-1) 38%, var(--fill-strong))',
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden className="mt-1.5 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
        {data.map((item, index) => <span key={`${item.label}-${index}`} className="caption truncate text-center text-[var(--muted)]">{item.label}</span>)}
      </div>
    </figure>
  )
}
