'use client'

import { muscleLevel } from '@/lib/insights'
import type { MuscleGroup } from '@/types'

type Shape =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rotate?: number }
  | { kind: 'path'; d: string }

interface Region {
  group: MuscleGroup
  shapes: Shape[]
}

const mirror = (cx: number, cy: number, rx: number, ry: number, rotate = 0): Shape[] => [
  { kind: 'ellipse', cx, cy, rx, ry, rotate },
  { kind: 'ellipse', cx: 100 - cx, cy, rx, ry, rotate: -rotate },
]

const FRONT: Region[] = [
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

const LEVEL_FILL = ['var(--heat-0)', 'var(--heat-1)', 'var(--heat-3)', 'var(--heat-4)'] as const

function Body({ regions, sets, label }: { regions: Region[]; sets: Map<MuscleGroup, number>; label: string }) {
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="8 0 84 196" className="h-auto w-full max-w-[150px]" aria-hidden>
        <path d={SILHOUETTE} fill="var(--fill)" />
        {regions.map((region) => {
          const fill = LEVEL_FILL[muscleLevel(sets.get(region.group) ?? 0)]
          return (
            <g key={region.group} fill={fill} stroke="var(--surface)" strokeWidth={0.8}>
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

const ORDER: MuscleGroup[] = ['Peitoral', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Antebraço', 'Abdômen', 'Trapézio', 'Lombar', 'Glúteo', 'Quadríceps', 'Posterior', 'Panturrilha']

export function MuscleMap({ sets, compact = false }: { sets: Map<MuscleGroup, number>; compact?: boolean }) {
  const summary = ORDER.map((group) => `${group}: ${Math.round(sets.get(group) ?? 0)} séries`).join(', ')
  const lagging = ORDER.filter((group) => muscleLevel(sets.get(group) ?? 0) <= 1)
  return (
    <div>
      <div role="img" aria-label={`Séries por músculo nos últimos 7 dias. ${summary}`} className="grid grid-cols-2 gap-4 px-2">
        <Body regions={FRONT} sets={sets} label="Frente" />
        <Body regions={BACK} sets={sets} label="Costas" />
      </div>
      <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2" aria-label="Legenda">
        {[
          ['Sem treino', LEVEL_FILL[0]],
          ['1–5 séries', LEVEL_FILL[1]],
          ['6–11', LEVEL_FILL[2]],
          ['12+', LEVEL_FILL[3]],
        ].map(([label, color]) => (
          <li key={label} className="caption flex items-center gap-1.5 text-[var(--muted)]">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{label}
          </li>
        ))}
      </ul>
      {!compact && (
        <dl className="mt-6 grid grid-cols-2 gap-x-6">
          {ORDER.map((group) => (
            <div key={group} className="flex items-baseline justify-between border-t border-[var(--separator)] py-2.5">
              <dt className="subhead">{group}</dt>
              <dd className="subhead numeric font-semibold">{Math.round(sets.get(group) ?? 0)}</dd>
            </div>
          ))}
        </dl>
      )}
      {compact && lagging.length > 0 && lagging.length < ORDER.length && (
        <p className="subhead mt-4 text-center text-[var(--muted)]">
          Pouco estímulo esta semana: <span className="text-[var(--foreground)]">{lagging.slice(0, 4).join(', ')}</span>{lagging.length > 4 ? ` e mais ${lagging.length - 4}` : ''}.
        </p>
      )}
    </div>
  )
}
