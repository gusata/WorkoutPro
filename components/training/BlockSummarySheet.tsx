'use client'

import { useMemo } from 'react'
import { addDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Trophy } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { blockEndDate, goalLabel, summarizeBlock } from '@/lib/trainingBlocks'
import { formatDecimal, formatVolume } from '@/lib/utils'
import type { Exercise, TrainingBlock, WorkoutSession } from '@/types'

export function blockDateRange(block: TrainingBlock) {
  const start = new Date(block.startDate)
  const end = addDays(blockEndDate(block), -1)
  return `${format(start, "d 'de' MMM", { locale: ptBR })} – ${format(end, "d 'de' MMM", { locale: ptBR })}`
}

/** End-of-block report: weekly volume vs plan and the records set during the block. */
export function BlockSummarySheet({ block, sessions, exercises, onClose, onNext }: {
  block: TrainingBlock | null
  sessions: WorkoutSession[]
  exercises: Exercise[]
  onClose: () => void
  onNext?: () => void
}) {
  const summary = useMemo(() => (block ? summarizeBlock(block, sessions, exercises) : null), [block, exercises, sessions])
  const maxVolume = Math.max(1, ...(summary?.weeks.map((week) => week.volume) ?? []))

  return (
    <Modal open={!!block} onClose={onClose} title="Resumo do bloco">
      {block && summary && (
        <div>
          <p className="eyebrow">{[goalLabel(block.goal), blockDateRange(block)].filter(Boolean).join(' · ')}</p>
          <h3 className="title-1 mt-1">{block.name}</h3>

          <dl className="mt-5 grid grid-cols-2 gap-3">
            {[
              [`${summary.sessions}`, 'Treinos'],
              [`${summary.doneSets}/${summary.plannedSets}`, 'Séries feitas / planejadas'],
              [formatVolume(summary.volume), 'Volume total'],
              [summary.volumeChangePct == null ? '—' : `${summary.volumeChangePct > 0 ? '+' : ''}${summary.volumeChangePct}%`, 'Volume 1ª → última semana'],
            ].map(([value, label]) => (
              <div key={label} className="flex flex-col-reverse rounded-[var(--radius-sm)] bg-[var(--fill)] px-3.5 py-3">
                <dt className="footnote text-[var(--muted)]">{label}</dt>
                <dd className="stat text-[22px]">{value}</dd>
              </div>
            ))}
          </dl>

          <p className="list-header mt-6">Volume por semana</p>
          <ul className="space-y-2">
            {summary.weeks.map((week) => (
              <li key={week.index} className="flex items-center gap-3">
                <span className="caption w-8 flex-none font-semibold text-[var(--muted)]">{week.deload ? 'D' : `S${week.index + 1}`}</span>
                <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--fill-strong)]" aria-hidden>
                  <span
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${(week.volume / maxVolume) * 100}%`, background: week.deload ? 'var(--success-fill)' : 'var(--accent-fill)' }}
                  />
                </span>
                <span className="footnote numeric w-36 flex-none text-right text-[var(--muted)]">
                  {week.doneSets}/{week.targetSets} séries · {formatVolume(week.volume)}
                </span>
              </li>
            ))}
          </ul>

          <p className="list-header mt-6">Recordes no bloco</p>
          {summary.records.length === 0 ? (
            <p className="subhead text-[var(--muted)]">Nenhum novo 1RM estimado neste bloco.</p>
          ) : (
            <ul className="list !bg-[var(--fill)]">
              {summary.records.slice(0, 8).map((record) => (
                <li key={record.exerciseId} className="grouped-row flex items-center gap-3 px-4 py-3">
                  <Trophy size={16} className="flex-none text-[#ff9f0a]" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{record.name}</span>
                  <span className="footnote numeric flex-none text-[var(--muted)]">
                    {formatDecimal(Math.round(record.before * 10) / 10)} → <strong className="text-[var(--foreground)]">{formatDecimal(Math.round(record.after * 10) / 10)} kg</strong>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-7 flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Fechar</Button>
            {onNext && <Button className="flex-1" onClick={onNext}>Próximo bloco</Button>}
          </div>
        </div>
      )}
    </Modal>
  )
}
