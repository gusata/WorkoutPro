'use client'

import { useState } from 'react'
import { formatSets, STATUS_LABEL, type VolumeStatus, type WeeklyMuscleRow } from '@/lib/muscleVolume'

const STATUS_CLASS: Record<VolumeStatus, string> = {
  below: 'text-[var(--warning)]',
  within: 'text-[var(--success)]',
  above: 'text-[var(--accent)]',
}

/**
 * Horizontal bars of weekly hard sets per muscle over a shaded target band, with
 * the status written out (never color alone).
 */
export function MuscleVolumeBars({ rows }: { rows: WeeklyMuscleRow[] }) {
  const [showAll, setShowAll] = useState(false)
  const routine = rows.filter((row) => row.inRoutine)
  const visible = showAll || routine.length === 0 ? rows : routine
  const hidden = rows.length - routine.length
  const scale = Math.max(...visible.map((row) => Math.max(row.sets, row.target.max * 1.2)), 1)
  const counts = { below: 0, within: 0, above: 0 }
  visible.forEach((row) => { counts[row.status] += 1 })

  return (
    <div>
      <p className="subhead text-[var(--muted)]">
        <span className="font-semibold text-[var(--success)]">{counts.within} na faixa</span>
        {' · '}<span className="font-semibold text-[var(--warning)]">{counts.below} abaixo</span>
        {' · '}<span className="font-semibold text-[var(--accent)]">{counts.above} acima</span>
      </p>
      <ul className="mt-4 space-y-3.5" aria-label="Séries por músculo e faixa-alvo">
        {visible.map((row) => {
          const label = `${row.muscle}: ${formatSets(row.sets)} séries, meta ${row.target.min} a ${row.target.max}, ${STATUS_LABEL[row.status]}`
          return (
            <li key={row.muscle} aria-label={label}>
              <div aria-hidden className="flex items-baseline justify-between gap-3">
                <span className="subhead">{row.muscle}</span>
                <span className="footnote numeric">
                  <span className="font-semibold">{formatSets(row.sets)}</span>
                  <span className="text-[var(--muted)]"> / {row.target.min}–{row.target.max}</span>
                  <span className={`ml-2 font-semibold ${STATUS_CLASS[row.status]}`}>{STATUS_LABEL[row.status]}</span>
                </span>
              </div>
              <div aria-hidden className="relative mt-1.5 h-2.5 rounded-full bg-[var(--fill)]">
                <div
                  className="absolute inset-y-0 bg-[color-mix(in_srgb,var(--success-fill)_24%,transparent)]"
                  style={{ left: `${(row.target.min / scale) * 100}%`, width: `${((row.target.max - row.target.min) / scale) * 100}%` }}
                />
                {row.sets > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
                    style={{
                      width: `${Math.max((Math.min(row.sets, scale) / scale) * 100, 2)}%`,
                      background: row.status === 'below' ? 'color-mix(in srgb, var(--data-1) 55%, var(--fill-strong))' : 'var(--data-1)',
                    }}
                  />
                )}
                {[row.target.min, row.target.max].map((value, index) => (
                  <div key={index} className="absolute -inset-y-[3px] w-[2px] -translate-x-1/2 rounded-full bg-[var(--success-fill)]" style={{ left: `${(value / scale) * 100}%` }} />
                ))}
              </div>
            </li>
          )
        })}
      </ul>
      <div className="caption mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[var(--muted)]" aria-hidden>
        <span className="flex items-center gap-1.5"><span className="h-2 w-3.5 bg-[color-mix(in_srgb,var(--success-fill)_24%,transparent)] shadow-[inset_2px_0_0_var(--success-fill),inset_-2px_0_0_var(--success-fill)]" />Faixa-alvo</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-3.5 rounded-full bg-[var(--data-1)]" />Séries de trabalho</span>
      </div>
      {hidden > 0 && routine.length > 0 && (
        <button type="button" onClick={() => setShowAll((value) => !value)} className="link mt-3 text-[15px]">
          {showAll ? 'Mostrar só os da rotina' : `Mostrar todos (${hidden} sem treino recente)`}
        </button>
      )}
    </div>
  )
}
