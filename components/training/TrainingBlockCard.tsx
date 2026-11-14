'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { BlockEditor } from '@/components/training/BlockEditor'
import { BlockSummarySheet, blockDateRange } from '@/components/training/BlockSummarySheet'
import { useProfileStore } from '@/stores/useProfileStore'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { getBlockProgress } from '@/lib/preferences'
import { archiveBlock, blockWeekSummaries, goalLabel, nextBlockDraft } from '@/lib/trainingBlocks'
import { formatVolume } from '@/lib/utils'
import type { TrainingBlock } from '@/types'

type EditorState = { initial: TrainingBlock | null; isNew: boolean } | null

export function TrainingBlockCard() {
  const profile = useProfileStore((state) => state.profile)
  const sessions = useProfileStore((state) => state.sessions)
  const updateProfile = useProfileStore((state) => state.updateProfile)
  const workouts = useWorkoutStore((state) => state.workouts)
  const exercises = useWorkoutStore((state) => state.exercises)
  const block = profile?.trainingBlock ?? null
  const history = useMemo(() => profile?.preferences?.trainingBlockHistory ?? [], [profile?.preferences?.trainingBlockHistory])
  const [editor, setEditor] = useState<EditorState>(null)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [summaryOf, setSummaryOf] = useState<{ block: TrainingBlock; offerNext: boolean } | null>(null)

  const weeks = useMemo(() => (block ? blockWeekSummaries(block, sessions) : []), [block, sessions])
  const progress = block ? getBlockProgress(block) : null
  const max = Math.max(1, ...weeks.map((week) => Math.max(week.targetSets, week.doneSets)))
  const coveredNames = block?.workoutIds?.length
    ? workouts.filter((workout) => block.workoutIds!.includes(workout.id)).map((workout) => workout.name)
    : []

  async function endBlock() {
    if (!block) return
    const nextHistory = archiveBlock(block, history)
    await updateProfile({ trainingBlock: null, preferences: { ...(profile?.preferences ?? {}), trainingBlockHistory: nextHistory } })
    setConfirmEnd(false)
    setSummaryOf({ block: nextHistory[0], offerNext: true })
  }

  async function saveBlock(next: TrainingBlock) {
    await updateProfile({ trainingBlock: next })
    setEditor(null)
  }

  return (
    <section id="bloco" aria-labelledby="block-title" className="stack-section scroll-mt-20">
      <div className="mb-4 px-1">
        <h2 id="block-title" className="section-title">Periodização.</h2>
        <p className="subhead mt-1 text-[var(--muted)]">Blocos de 4 a 8 semanas com volume crescente e deload no fim.</p>
      </div>

      {!block ? (
        <div className="tile text-center">
          <p className="eyebrow">{history.length ? 'Entre blocos' : 'Novo'}</p>
          <h3 className="title-1 mt-1">Treine em blocos.</h3>
          <p className="subhead mx-auto mt-2 max-w-sm text-[var(--muted)]">
            O app aumenta as séries de cada exercício semana a semana e programa uma semana leve para você recuperar.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {history[0] && <Button onClick={() => setEditor({ initial: nextBlockDraft(history[0]), isNew: true })}>Próximo bloco</Button>}
            <Button variant={history[0] ? 'secondary' : 'primary'} onClick={() => setEditor({ initial: null, isNew: true })}>Criar bloco</Button>
          </div>
        </div>
      ) : (
        <div className="tile">
          <p className="eyebrow">
            {progress?.notStarted ? `Começa em ${format(new Date(block.startDate), "d 'de' MMM", { locale: ptBR })}`
              : progress?.finished ? 'Bloco concluído'
                : `Semana ${progress?.weekNumber} de ${block.weeks}${progress?.week?.deload ? ' · Deload' : ''}`}
          </p>
          <h3 className="title-1 mt-1">{block.name}</h3>
          <p className="footnote mt-1 text-[var(--muted)]">
            {[goalLabel(block.goal), blockDateRange(block), coveredNames.length ? coveredNames.join(', ') : 'Todas as rotinas'].filter(Boolean).join(' · ')}
          </p>
          {progress?.week && (
            <p className="subhead mt-3 text-[var(--muted)]">
              {progress.week.deload
                ? <>Semana leve: <span className="font-semibold text-[var(--foreground)]">{progress.week.targetSets} séries</span>, metade por exercício e carga ~10% menor. </>
                : <>Meta desta semana: <span className="font-semibold text-[var(--foreground)]">{progress.week.targetSets} séries</span>. </>}
              Já feitas: {weeks[progress.week.index]?.doneSets ?? 0}. As séries de cada exercício aparecem na execução.
            </p>
          )}

          <figure className="mt-7">
            <figcaption className="sr-only">
              {weeks.map((week) => `Semana ${week.index + 1}: meta ${week.targetSets}, feitas ${week.doneSets}`).join('; ')}
            </figcaption>
            <div aria-hidden className="flex h-36 items-end gap-2">
              {weeks.map((week) => {
                const current = progress?.week?.index === week.index
                return (
                  <div key={week.index} className="relative flex h-full flex-1 flex-col justify-end">
                    <div className="relative w-full rounded-[6px] bg-[var(--fill-strong)]" style={{ height: `${(week.targetSets / max) * 100}%` }}>
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-[6px]"
                        style={{
                          height: `${Math.min(100, (week.doneSets / Math.max(week.targetSets, 1)) * 100)}%`,
                          background: week.deload ? 'var(--success-fill)' : 'var(--accent-fill)',
                          opacity: current || week.doneSets > 0 ? 1 : 0,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <div aria-hidden className="mt-2 flex gap-2">
              {weeks.map((week) => (
                <span key={week.index} className={`caption flex-1 text-center ${progress?.week?.index === week.index ? 'font-bold text-[var(--foreground)]' : 'text-[var(--muted)]'}`}>
                  {week.deload ? 'D' : `S${week.index + 1}`}
                </span>
              ))}
            </div>
          </figure>

          <ul className="mt-6 divide-y divide-[var(--separator)] rounded-[var(--radius-sm)] bg-[var(--fill)]">
            {weeks.map((week) => (
              <li key={week.index} className={`flex items-center gap-3 px-3.5 py-2.5 ${progress?.week?.index === week.index ? 'font-semibold' : ''}`}>
                <span className="footnote w-24 flex-none">{week.deload ? `Deload (S${week.index + 1})` : `Semana ${week.index + 1}`}</span>
                <span className="footnote numeric flex-1 text-right text-[var(--muted)]">
                  <span className="text-[var(--foreground)]">{week.doneSets}</span>/{week.targetSets} séries{week.volume > 0 ? ` · ${formatVolume(week.volume)}` : ''}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap gap-3">
            {progress?.finished
              ? <Button size="sm" onClick={() => void endBlock()}>Ver resumo e encerrar</Button>
              : <Button variant="secondary" size="sm" onClick={() => setEditor({ initial: block, isNew: false })}>Editar</Button>}
            {!progress?.finished && <Button variant="ghost" size="sm" onClick={() => setConfirmEnd(true)}>Encerrar bloco</Button>}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-6">
          <p className="list-header">Blocos anteriores</p>
          <div className="list">
            {history.map((item) => (
              <button key={item.id} type="button" onClick={() => setSummaryOf({ block: item, offerNext: !block })} className="grouped-row flex min-h-14 w-full items-center gap-3 px-5 py-3 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.name}</span>
                  <span className="footnote block text-[var(--muted)]">{[goalLabel(item.goal), `${item.weeks} semanas`, blockDateRange(item)].filter(Boolean).join(' · ')}</span>
                </span>
                <ChevronRight size={18} className="flex-none text-[var(--muted)]" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      )}

      {editor && (
        <BlockEditor
          initial={editor.initial}
          isNew={editor.isNew}
          workouts={workouts}
          onClose={() => setEditor(null)}
          onSave={saveBlock}
        />
      )}
      <BlockSummarySheet
        block={summaryOf?.block ?? null}
        sessions={sessions}
        exercises={exercises}
        onClose={() => setSummaryOf(null)}
        onNext={summaryOf?.offerNext && !block ? () => { const source = summaryOf.block; setSummaryOf(null); setEditor({ initial: nextBlockDraft(source), isNew: true }) } : undefined}
      />
      <Modal open={confirmEnd} onClose={() => setConfirmEnd(false)} title="Encerrar bloco">
        <p className="subhead mb-6 text-[var(--muted)]">O bloco vai para o histórico com um resumo. Suas metas voltam a ser as metas semanais fixas e o histórico de treinos não muda.</p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmEnd(false)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={() => void endBlock()}>Encerrar</Button>
        </div>
      </Modal>
    </section>
  )
}
