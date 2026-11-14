'use client'

import { useMemo } from 'react'
import { Bandage, TriangleAlert } from 'lucide-react'
import { SectionHeader } from '@/components/layout/PageHeader'
import { discomfortHistory, discomfortIntensityLabel, discomfortLocationLabel, repeatedDiscomfort } from '@/lib/discomfort'
import { formatDate } from '@/lib/utils'
import type { WorkoutSession } from '@/types'

/** Discomfort flagged on this exercise in past sessions (hidden when there is none). */
export function DiscomfortHistory({ exerciseId, sessions }: { exerciseId: string; sessions: WorkoutSession[] }) {
  const entries = useMemo(() => discomfortHistory(exerciseId, sessions), [exerciseId, sessions])
  const warning = useMemo(() => repeatedDiscomfort(exerciseId, sessions), [exerciseId, sessions])
  if (entries.length === 0) return null

  return (
    <section aria-labelledby="discomfort-title" className="stack-section">
      <SectionHeader id="discomfort-title" title="Desconforto." subtitle="Dores registradas durante os treinos com este exercício." />
      {warning && (
        <p role="note" className="footnote mb-3 flex items-start gap-2 rounded-[var(--radius-sm)] bg-[var(--warning-soft)] px-3.5 py-3 text-[var(--foreground)]">
          <TriangleAlert size={16} className="mt-0.5 flex-none text-[var(--warning)]" aria-hidden />
          Desconforto em {warning.count} das últimas {warning.window} sessões. Considere reduzir a carga ou usar uma alternativa.
        </p>
      )}
      <div className="list">
        {entries.map((entry) => (
          <div key={entry.sessionId} className="grouped-row flex items-start gap-4 px-5 py-3.5">
            <span aria-hidden className="icon-chip rounded-full !bg-[var(--warning-soft)] !text-[var(--warning)]"><Bandage size={15} /></span>
            <div className="min-w-0 flex-1">
              <p className="headline">{discomfortLocationLabel(entry.discomfort.location)}</p>
              <p className="footnote mt-0.5 text-[var(--muted)]">
                {formatDate(entry.date)} · {entry.discomfort.intensity}/3 {discomfortIntensityLabel(entry.discomfort.intensity).toLowerCase()}
              </p>
              {entry.discomfort.note && <p className="subhead mt-1">{entry.discomfort.note}</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
