'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  formatSets, INTENSITY_LEGEND, MUSCLES, muscleIntensity, STATUS_LABEL, volumeStatus,
  type Muscle, type MuscleVolume,
} from '@/lib/muscleVolume'
import type { MuscleGroup, MuscleTargetRange } from '@/types'

type Shape =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rotate?: number }
  | { kind: 'path'; d: string }

interface Region {
  group: Muscle
  shapes: Shape[]
}

const mirror = (cx: number, cy: number, rx: number, ry: number, rotate = 0): Shape[] => [
  { kind: 'ellipse', cx, cy, rx, ry, rotate },
  { kind: 'ellipse', cx: 100 - cx, cy, rx, ry, rotate: -rotate },
]

// Simplified, hand-drawn geometric figure (viewBox 8 0 84 196), not anatomical art.
const FRONT: Region[] = [
  { group: 'Trapézio', shapes: [
    { kind: 'path', d: 'M45.5 31 Q41 35 35 38.5 Q40.5 40 46 37.5 Z' },
    { kind: 'path', d: 'M54.5 31 Q59 35 65 38.5 Q59.5 40 54 37.5 Z' },
  ] },
  { group: 'Ombros', shapes: mirror(31, 47, 8, 7.5, -20) },
  { group: 'Peitoral', shapes: [
    { kind: 'path', d: 'M50 42 C44 40 38 41 36 46 C35 52 38 57 44 58 C47 58 50 56 50 53 Z' },
    { kind: 'path', d: 'M50 42 C56 40 62 41 64 46 C65 52 62 57 56 58 C53 58 50 56 50 53 Z' },
  ] },
  { group: 'Bíceps', shapes: mirror(25.5, 65, 4.6, 10, 12) },
  { group: 'Antebraço', shapes: mirror(21, 88, 4.2, 11.5, 10) },
  { group: 'Abdômen', shapes: [{ kind: 'path', d: 'M43 61 Q50 59 57 61 L56.5 92 Q50 96 43.5 92 Z' }] },
  { group: 'Quadríceps', shapes: mirror(42.5, 124, 7.6, 19, 4) },
  { group: 'Panturrilha', shapes: mirror(41.5, 168, 4.6, 12) },
]

const BACK: Region[] = [
  { group: 'Trapézio', shapes: [{ kind: 'path', d: 'M50 30 L58 34 L68 41 Q58 44 50 58 Q42 44 32 41 L42 34 Z' }] },
  { group: 'Ombros', shapes: mirror(31, 47, 8, 7.5, -20) },
  { group: 'Costas', shapes: [
    { kind: 'path', d: 'M49 58 Q42 46 34 47 Q34 62 41 78 Q46 80 49 76 Z' },
    { kind: 'path', d: 'M51 58 Q58 46 66 47 Q66 62 59 78 Q54 80 51 76 Z' },
  ] },
  { group: 'Tríceps', shapes: mirror(25.5, 64, 4.6, 10, 12) },
  { group: 'Antebraço', shapes: mirror(21, 88, 4.2, 11.5, 10) },
  { group: 'Lombar', shapes: [{ kind: 'path', d: 'M43.5 80 Q50 83 56.5 80 L56 94 Q50 96 44 94 Z' }] },
  { group: 'Glúteo', shapes: mirror(43.5, 104, 7.6, 8.5) },
  { group: 'Posterior', shapes: mirror(42.5, 131, 7, 16, 4) },
  { group: 'Panturrilha', shapes: mirror(41.5, 166, 5, 12.5) },
]

/** Neutral silhouette behind the muscles. */
const SILHOUETTE =
  'M50 6 a9 9 0 1 1 -0.01 0 Z ' +
  'M45 26 h10 v6 h-10 Z ' +
  'M33 38 Q50 30 67 38 Q73 42 72 50 L68 62 Q66 80 60 98 L60 104 Q62 112 58 112 L42 112 Q38 112 40 104 L40 98 Q34 80 32 62 L28 50 Q27 42 33 38 Z ' +
  'M24 46 Q30 44 32 52 L30 76 Q28 98 25 102 Q19 104 17 99 Q16 84 20 70 Z ' +
  'M76 46 Q70 44 68 52 L70 76 Q72 98 75 102 Q81 104 83 99 Q84 84 80 70 Z ' +
  'M35 104 Q42 100 49 106 L48 146 Q47 160 46 182 Q44 190 39 190 Q35 188 36 180 Q34 160 35 146 Z ' +
  'M65 104 Q58 100 51 106 L52 146 Q53 160 54 182 Q56 190 61 190 Q65 188 64 180 Q66 160 65 146 Z'

const LEVEL_FILL = ['var(--heat-0)', 'var(--heat-1)', 'var(--heat-2)', 'var(--heat-3)', 'var(--heat-4)'] as const

function Body({ regions, sets, label, selected, onSelect }: {
  regions: Region[]
  sets: Map<MuscleGroup, number>
  label: string
  selected: Muscle | null
  onSelect?: (muscle: Muscle) => void
}) {
  return (
    <figure className="flex flex-col items-center">
      {/* Pointer shortcut only; the list below is the accessible way to pick a muscle. */}
      <svg viewBox="8 0 84 196" className="h-auto w-full max-w-[170px]" aria-hidden>
        <path d={SILHOUETTE} fill="var(--fill)" />
        {regions.map((region) => {
          const fill = LEVEL_FILL[muscleIntensity(sets.get(region.group) ?? 0)]
          const isSelected = selected === region.group
          return (
            <g
              key={region.group}
              fill={fill}
              stroke={isSelected ? 'var(--foreground)' : 'var(--surface)'}
              strokeWidth={isSelected ? 1.6 : 0.8}
              onClick={onSelect ? () => onSelect(region.group) : undefined}
              className={onSelect ? 'cursor-pointer' : undefined}
            >
              {region.shapes.map((shape, index) =>
                shape.kind === 'ellipse'
                  ? <ellipse key={index} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} transform={shape.rotate ? `rotate(${shape.rotate} ${shape.cx} ${shape.cy})` : undefined} />
                  : <path key={index} d={shape.d} />
              )}
            </g>
          )
        })}
      </svg>
      <figcaption className="caption mt-2 font-semibold text-[var(--muted)]">{label}</figcaption>
    </figure>
  )
}

function Legend() {
  return (
    <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2" aria-label="Legenda: séries por semana">
      {INTENSITY_LEGEND.map((label, index) => (
        <li key={label} className="caption numeric flex items-center gap-1.5 text-[var(--muted)]">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: LEVEL_FILL[index] }} />
          {index === 0 ? 'Sem séries' : label}
        </li>
      ))}
      <li className="caption text-[var(--muted)]">séries/semana</li>
    </ul>
  )
}

export interface MuscleMapProps {
  /** Hard sets per week (or weekly average) per muscle; drives the colors. */
  sets: Map<MuscleGroup, number>
  /** Sets and exercises behind each muscle in the period, for the tap-to-see panel. */
  details?: Map<Muscle, MuscleVolume>
  /** Weekly target ranges, to show the status in the panel. */
  targets?: Record<Muscle, MuscleTargetRange>
  /** "nesta semana", "nas últimas 4 semanas"... */
  periodLabel?: string
  /** Weeks covered by `details` (sets are divided by this for the weekly average). */
  weeks?: number
  compact?: boolean
}

export function MuscleMap({ sets, details, targets, periodLabel = 'nos últimos 7 dias', weeks = 1, compact = false }: MuscleMapProps) {
  const [selected, setSelected] = useState<Muscle | null>(null)
  const summary = MUSCLES.map((group) => `${group}: ${formatSets(sets.get(group) ?? 0)} séries`).join(', ')
  const lagging = MUSCLES.filter((group) => (sets.get(group) ?? 0) < 6)
  const interactive = !compact
  const toggle = (muscle: Muscle) => setSelected((current) => (current === muscle ? null : muscle))

  return (
    <div>
      <div role="img" aria-label={`Séries por músculo ${periodLabel}${weeks > 1 ? ', média por semana' : ''}. ${summary}`} className="grid grid-cols-2 gap-4 px-2">
        <Body regions={FRONT} sets={sets} label="Frente" selected={selected} onSelect={interactive ? toggle : undefined} />
        <Body regions={BACK} sets={sets} label="Costas" selected={selected} onSelect={interactive ? toggle : undefined} />
      </div>
      <Legend />
      {interactive && selected && (
        <MuscleDetail
          muscle={selected}
          weekly={sets.get(selected) ?? 0}
          volume={details?.get(selected)}
          target={targets?.[selected]}
          periodLabel={periodLabel}
          weeks={weeks}
          onClose={() => setSelected(null)}
        />
      )}
      {interactive && (
        <>
          <p className="footnote mt-6 text-[var(--muted)]">Toque em um músculo para ver séries e exercícios.</p>
          <ul className="mt-2 grid grid-cols-2 gap-x-6" aria-label={`Séries por músculo ${periodLabel}`}>
            {MUSCLES.map((group) => (
              <li key={group}>
                <button
                  type="button"
                  aria-pressed={selected === group}
                  onClick={() => toggle(group)}
                  className={cn(
                    'flex min-h-11 w-full items-center justify-between gap-2 border-t border-[var(--separator)] py-2 text-left',
                    selected === group && 'font-semibold text-[var(--accent)]'
                  )}
                >
                  <span className="subhead flex min-w-0 items-center gap-2">
                    <span aria-hidden className="h-2 w-2 flex-none rounded-full" style={{ background: LEVEL_FILL[muscleIntensity(sets.get(group) ?? 0)] }} />
                    <span className="truncate">{group}</span>
                  </span>
                  <span className="subhead numeric font-semibold">{formatSets(sets.get(group) ?? 0)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {compact && lagging.length > 0 && lagging.length < MUSCLES.length && (
        <p className="subhead mt-4 text-center text-[var(--muted)]">
          Pouco estímulo {periodLabel}: <span className="text-[var(--foreground)]">{lagging.slice(0, 4).join(', ')}</span>{lagging.length > 4 ? ` e mais ${lagging.length - 4}` : ''}.
        </p>
      )}
    </div>
  )
}

function MuscleDetail({ muscle, weekly, volume, target, periodLabel, weeks, onClose }: {
  muscle: Muscle
  weekly: number
  volume?: MuscleVolume
  target?: MuscleTargetRange
  periodLabel: string
  weeks: number
  onClose: () => void
}) {
  const total = volume?.sets ?? 0
  const status = target ? volumeStatus(weekly, target) : null
  return (
    <section aria-live="polite" aria-label={`Detalhes de ${muscle}`} className="mt-5 rounded-[var(--radius-md)] bg-[var(--fill)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="headline">{muscle}</p>
          <p className="footnote numeric mt-0.5 text-[var(--muted)]">
            {formatSets(total)} {total === 1 ? 'série' : 'séries'} {periodLabel}
            {weeks > 1 ? ` · ${formatSets(weekly)}/semana` : ''}
            {target ? ` · meta ${target.min}–${target.max}` : ''}
            {status ? ` · ${STATUS_LABEL[status]}` : ''}
          </p>
        </div>
        <button type="button" onClick={onClose} className="-mr-2 -mt-2 flex h-11 w-11 flex-none items-center justify-center rounded-full text-[var(--muted)]" aria-label="Fechar detalhes">
          <X size={18} aria-hidden />
        </button>
      </div>
      {volume && volume.exercises.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {volume.exercises.map((item) => (
            <li key={item.exerciseId} className="flex items-baseline justify-between gap-3">
              <span className="subhead min-w-0 truncate">
                {item.name}
                {!item.primary && <span className="text-[var(--muted)]"> · indireto</span>}
              </span>
              <span className="subhead numeric flex-none text-[var(--muted)]">
                {item.sets} {item.sets === 1 ? 'série' : 'séries'}{!item.primary ? ` (conta ${formatSets(item.credited)})` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="subhead mt-2 text-[var(--muted)]">Nenhuma série de trabalho {periodLabel}.</p>
      )}
    </section>
  )
}
