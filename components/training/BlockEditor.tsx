'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Switch } from '@/components/ui/Switch'
import { DecimalInput } from '@/components/ui/DecimalInput'
import { getBlockWeeks } from '@/lib/preferences'
import { defaultBaseWeeklySets, mondayOf, TRAINING_GOALS } from '@/lib/trainingBlocks'
import { generateId } from '@/lib/utils'
import type { TrainingBlock, TrainingGoal, Workout } from '@/types'

const WEEK_OPTIONS = ['4', '5', '6', '7', '8'].map((value) => ({ value, label: `${value} sem` }))

const RAMP_OPTIONS = [
  { value: '0', label: '0%' },
  { value: '5', label: '+5%' },
  { value: '10', label: '+10%' },
  { value: '15', label: '+15%' },
]

const START_OPTIONS = [
  { value: 'this', label: 'Esta semana' },
  { value: 'next', label: 'Próxima semana' },
] as const

const GOAL_NAMES: Record<TrainingGoal, string> = { hipertrofia: 'Hipertrofia', forca: 'Força', condicionamento: 'Condicionamento' }

/**
 * Create/edit form for a training block. `initial` with `isNew` pre-fills a new block
 * (e.g. the next block after a finished one).
 */
export function BlockEditor({ initial, isNew, workouts, onClose, onSave }: {
  initial: TrainingBlock | null
  isNew: boolean
  workouts: Workout[]
  onClose: () => void
  onSave: (block: TrainingBlock) => Promise<void>
}) {
  const [name, setName] = useState(initial?.name ?? 'Hipertrofia')
  const [goal, setGoal] = useState<TrainingGoal>(initial?.goal ?? 'hipertrofia')
  const [weeks, setWeeks] = useState(String(Math.min(8, Math.max(4, initial?.weeks ?? 6))))
  const [workoutIds, setWorkoutIds] = useState<string[]>((initial?.workoutIds ?? []).filter((id) => workouts.some((workout) => workout.id === id)))
  const suggested = useMemo(() => defaultBaseWeeklySets(workouts, workoutIds), [workoutIds, workouts])
  const [base, setBase] = useState(initial?.baseWeeklySets ?? suggested)
  const [ramp, setRamp] = useState(String(initial?.weeklyIncreasePct ?? 10))
  const [deload, setDeload] = useState(initial?.deloadLastWeek ?? true)
  const [start, setStart] = useState<'this' | 'next'>(() => {
    if (!initial) return new Date().getDay() === 1 ? 'this' : 'next'
    return new Date(initial.startDate) > new Date() ? 'next' : 'this'
  })
  const [saving, setSaving] = useState(false)
  const startDate = !isNew && initial ? new Date(initial.startDate) : mondayOf(new Date(), start === 'next')
  const preview = getBlockWeeks({
    id: 'preview', name, startDate, weeks: Number(weeks), baseWeeklySets: base, weeklyIncreasePct: Number(ramp), deloadLastWeek: deload,
  })

  function toggleWorkout(id: string) {
    setWorkoutIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Novo bloco' : 'Editar bloco'}>
      <div className="space-y-5">
        <Input label="Nome" value={name} onChange={(event) => setName(event.target.value)} />
        <div>
          <p className="mb-2 px-1 text-[13px] font-semibold text-[var(--muted)]">Objetivo</p>
          <SegmentedControl
            label="Objetivo"
            value={goal}
            onChange={(value) => {
              if (Object.values(GOAL_NAMES).includes(name.trim())) setName(GOAL_NAMES[value])
              setGoal(value)
            }}
            options={TRAINING_GOALS}
          />
        </div>
        <div>
          <p className="mb-2 px-1 text-[13px] font-semibold text-[var(--muted)]">Duração</p>
          <SegmentedControl label="Duração" value={weeks} onChange={setWeeks} options={WEEK_OPTIONS} />
        </div>
        {workouts.length > 0 && (
          <fieldset>
            <legend className="mb-2 px-1 text-[13px] font-semibold text-[var(--muted)]">Rotinas do bloco</legend>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="chip" aria-pressed={workoutIds.length === 0} onClick={() => setWorkoutIds([])}>Todas</button>
              {workouts.map((workout) => (
                <button key={workout.id} type="button" className="chip" aria-pressed={workoutIds.includes(workout.id)} onClick={() => toggleWorkout(workout.id)}>
                  {workoutIds.includes(workout.id) && <Check size={13} strokeWidth={3} aria-hidden />}{workout.name}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <label className="block">
          <span className="mb-2 block px-1 text-[13px] font-semibold text-[var(--muted)]">Séries semanais na semana 1</span>
          <DecimalInput integer min={1} max={300} value={base} onValueChange={setBase} className="field numeric" />
          {suggested !== base && (
            <button type="button" className="link mt-1.5 px-1 text-[15px]" onClick={() => setBase(suggested)}>
              Usar {suggested} (séries das rotinas × dias na semana)
            </button>
          )}
        </label>
        <div>
          <p className="mb-2 px-1 text-[13px] font-semibold text-[var(--muted)]">Aumento semanal</p>
          <SegmentedControl label="Aumento semanal" value={ramp} onChange={setRamp} options={RAMP_OPTIONS} />
        </div>
        <div className="flex items-center justify-between gap-4 px-1">
          <span>
            <span className="block">Deload na última semana</span>
            <span className="footnote text-[var(--muted)]">Metade das séries e carga ~10% menor.</span>
          </span>
          <Switch label="Deload na última semana" checked={deload} onChange={setDeload} />
        </div>
        {isNew && (
          <div>
            <p className="mb-2 px-1 text-[13px] font-semibold text-[var(--muted)]">Início</p>
            <SegmentedControl label="Início" value={start} onChange={setStart} options={[...START_OPTIONS]} />
          </div>
        )}
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
                id: !isNew && initial ? initial.id : generateId(),
                name: name.trim(),
                goal,
                workoutIds,
                startDate,
                weeks: Number(weeks),
                baseWeeklySets: base,
                weeklyIncreasePct: Number(ramp),
                deloadLastWeek: deload,
                endedAt: null,
              })
            } finally {
              setSaving(false)
            }
          }}
        >
          {isNew ? 'Começar bloco' : 'Salvar'}
        </Button>
      </div>
    </Modal>
  )
}
