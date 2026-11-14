'use client'

import { useMemo, useState } from 'react'
import { addDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Switch } from '@/components/ui/Switch'
import { DecimalInput } from '@/components/ui/DecimalInput'
import { useProfileStore } from '@/stores/useProfileStore'
import { getBlockProgress, getBlockWeeks, getWeeklyGoals } from '@/lib/preferences'
import { generateId } from '@/lib/utils'
import type { TrainingBlock } from '@/types'

const WEEK_OPTIONS = [
  { value: '4', label: '4 sem' },
  { value: '5', label: '5 sem' },
  { value: '6', label: '6 sem' },
  { value: '8', label: '8 sem' },
] as const

const RAMP_OPTIONS = [
  { value: '5', label: '+5%' },
  { value: '10', label: '+10%' },
  { value: '15', label: '+15%' },
] as const

function nextMonday(from = new Date()) {
  const day = from.getDay()
  const date = addDays(from, day === 1 ? 0 : (8 - day) % 7)
  date.setHours(0, 0, 0, 0)
  return date
}

export function TrainingBlockCard() {
  const profile = useProfileStore((state) => state.profile)
  const sessions = useProfileStore((state) => state.sessions)
  const updateProfile = useProfileStore((state) => state.updateProfile)
  const block = profile?.trainingBlock ?? null
  const [editing, setEditing] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)

  const weeks = useMemo(() => (block ? getBlockWeeks(block) : []), [block])
  const progress = block ? getBlockProgress(block) : null
  const actual = useMemo(() => weeks.map((week) => {
    const end = addDays(week.start, 7)
    return sessions
      .filter((session) => session.finishedAt && new Date(session.finishedAt) >= week.start && new Date(session.finishedAt) < end)
      .reduce((total, session) => total + session.exercises.reduce((sum, item) => sum + item.sets.filter((set) => (set.setType ?? 'normal') !== 'warmup').length, 0), 0)
  }), [sessions, weeks])
  const max = Math.max(1, ...weeks.map((week) => week.targetSets), ...actual)

  return (
    <section id="bloco" aria-labelledby="block-title" className="stack-section scroll-mt-20">
      <div className="mb-4 px-1">
        <h2 id="block-title" className="section-title">Periodização.</h2>
        <p className="subhead mt-1 text-[var(--muted)]">Blocos de 4 a 8 semanas com volume crescente e deload no fim.</p>
      </div>

      {!block ? (
        <div className="tile text-center">
          <p className="eyebrow">Novo</p>
          <h3 className="title-1 mt-1">Treine em blocos.</h3>
          <p className="subhead mx-auto mt-2 max-w-sm text-[var(--muted)]">
            O app aumenta sua meta de séries a cada semana e programa uma semana leve para você recuperar.
          </p>
          <Button className="mt-6" onClick={() => setEditing(true)}>Criar bloco</Button>
        </div>
      ) : (
        <div className="tile">
          <p className="eyebrow">
            {progress?.notStarted ? `Começa em ${format(new Date(block.startDate), "d 'de' MMM", { locale: ptBR })}`
              : progress?.finished ? 'Bloco concluído'
                : `Semana ${progress?.weekNumber} de ${block.weeks}${progress?.week?.deload ? ' · Deload' : ''}`}
          </p>
          <h3 className="title-1 mt-1">{block.name}</h3>
          {progress?.week && (
            <p className="subhead mt-2 text-[var(--muted)]">
              Meta desta semana: <span className="font-semibold text-[var(--foreground)]">{progress.week.targetSets} séries</span>. Já feitas: {actual[progress.week.index]}.
            </p>
          )}

          <figure className="mt-7">
            <figcaption className="sr-only">
              {weeks.map((week, index) => `Semana ${index + 1}: meta ${week.targetSets}, feitas ${actual[index]}`).join('; ')}
            </figcaption>
            <div aria-hidden className="flex h-36 items-end gap-2">
              {weeks.map((week, index) => {
                const current = progress?.week?.index === index
                return (
                  <div key={week.index} className="relative flex h-full flex-1 flex-col justify-end">
                    <div className="relative w-full rounded-[6px] bg-[var(--fill-strong)]" style={{ height: `${(week.targetSets / max) * 100}%` }}>
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-[6px]"
                        style={{
                          height: `${Math.min(100, (actual[index] / Math.max(week.targetSets, 1)) * 100)}%`,
                          background: week.deload ? 'var(--success-fill)' : 'var(--accent-fill)',
                          opacity: current || actual[index] > 0 ? 1 : 0,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <div aria-hidden className="mt-2 flex gap-2">
              {weeks.map((week, index) => (
                <span key={week.index} className={`caption flex-1 text-center ${progress?.week?.index === index ? 'font-bold text-[var(--foreground)]' : 'text-[var(--muted)]'}`}>
                  {week.deload ? 'D' : `S${index + 1}`}
                </span>
              ))}
            </div>
          </figure>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Editar</Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmEnd(true)}>Encerrar bloco</Button>
          </div>
        </div>
      )}

      {editing && (
        <BlockEditor
          initial={block}
          defaultSets={getWeeklyGoals(profile).sets}
          onClose={() => setEditing(false)}
          onSave={async (next) => { await updateProfile({ trainingBlock: next }); setEditing(false) }}
        />
      )}
      <Modal open={confirmEnd} onClose={() => setConfirmEnd(false)} title="Encerrar bloco">
        <p className="subhead mb-6 text-[var(--muted)]">Suas metas voltam a ser as metas semanais fixas. O histórico de treinos não muda.</p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmEnd(false)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={async () => { await updateProfile({ trainingBlock: null }); setConfirmEnd(false) }}>Encerrar</Button>
        </div>
      </Modal>
    </section>
  )
}

function BlockEditor({ initial, defaultSets, onClose, onSave }: {
  initial: TrainingBlock | null
  defaultSets: number
  onClose: () => void
  onSave: (block: TrainingBlock) => Promise<void>
}) {
  const [name, setName] = useState(initial?.name ?? 'Hipertrofia')
  const [weeks, setWeeks] = useState(String(initial?.weeks ?? 6))
  const [base, setBase] = useState(initial?.baseWeeklySets ?? defaultSets)
  const [ramp, setRamp] = useState(String(initial?.weeklyIncreasePct ?? 10))
  const [deload, setDeload] = useState(initial?.deloadLastWeek ?? true)
  const [saving, setSaving] = useState(false)
  const startDate = initial ? new Date(initial.startDate) : nextMonday()
  const preview = getBlockWeeks({ id: 'preview', name, startDate, weeks: Number(weeks), baseWeeklySets: base, weeklyIncreasePct: Number(ramp), deloadLastWeek: deload })

  return (
    <Modal open onClose={onClose} title={initial ? 'Editar bloco' : 'Novo bloco'}>
      <div className="space-y-5">
        <Input label="Nome" value={name} onChange={(event) => setName(event.target.value)} />
        <div>
          <p className="mb-2 px-1 text-[13px] font-semibold text-[var(--muted)]">Duração</p>
          <SegmentedControl label="Duração" value={weeks} onChange={setWeeks} options={[...WEEK_OPTIONS]} />
        </div>
        <label className="block">
          <span className="mb-2 block px-1 text-[13px] font-semibold text-[var(--muted)]">Séries na semana 1</span>
          <DecimalInput integer min={1} max={300} value={base} onValueChange={setBase} className="field numeric" />
        </label>
        <div>
          <p className="mb-2 px-1 text-[13px] font-semibold text-[var(--muted)]">Aumento semanal</p>
          <SegmentedControl label="Aumento semanal" value={ramp} onChange={setRamp} options={[...RAMP_OPTIONS]} />
        </div>
        <div className="flex items-center justify-between gap-4 px-1">
          <span>
            <span className="block">Deload na última semana</span>
            <span className="footnote text-[var(--muted)]">Metade do volume para recuperar.</span>
          </span>
          <Switch label="Deload na última semana" checked={deload} onChange={setDeload} />
        </div>
        <p className="footnote px-1 text-[var(--muted)]">
          Começa {format(startDate, "EEEE, d 'de' MMM", { locale: ptBR })}. Metas: {preview.map((week) => week.targetSets).join(' → ')} séries.
        </p>
        <Button
          size="lg"
          className="w-full"
          disabled={saving || !name.trim() || base <= 0}
          onClick={async () => {
            setSaving(true)
            try {
              await onSave({
                id: initial?.id ?? generateId(),
                name: name.trim(),
                startDate,
                weeks: Number(weeks),
                baseWeeklySets: base,
                weeklyIncreasePct: Number(ramp),
                deloadLastWeek: deload,
              })
            } finally {
              setSaving(false)
            }
          }}
        >
          {initial ? 'Salvar' : 'Começar bloco'}
        </Button>
      </div>
    </Modal>
  )
}
