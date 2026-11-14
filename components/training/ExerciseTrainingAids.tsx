'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Bandage, CalendarRange, Flame, Replace, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Switch } from '@/components/ui/Switch'
import { useProfileStore } from '@/stores/useProfileStore'
import { useSessionStore } from '@/stores/useSessionStore'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { classifyExercise, generateWarmupSets, type ProgressionSuggestion, type WarmupStep } from '@/lib/training'
import { planExerciseForWeek, planMatchesSets } from '@/lib/trainingBlocks'
import {
  alternativesFor, describeDiscomfort, DISCOMFORT_INTENSITIES, DISCOMFORT_LOCATIONS, discomfortLocationLabel, repeatedDiscomfort,
} from '@/lib/discomfort'
import { formatDecimal } from '@/lib/utils'
import { cn } from '@/lib/cn'
import type { ActiveExercise, DiscomfortLocation, DiscomfortNote } from '@/types'

const OPTION_BUTTON = 'flex min-h-12 items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--fill)] px-3.5 text-left text-[15px] font-medium'

function isWarmup(set: { setType?: string }) {
  return (set.setType ?? 'normal') === 'warmup'
}

function useExerciseKind(exercise: ActiveExercise) {
  const stored = useWorkoutStore((state) => state.exercises.find((item) => item.id === exercise.exerciseId))
  const equipment = exercise.equipment ?? stored?.equipment
  return useMemo(() => classifyExercise(exercise.exerciseName, equipment), [equipment, exercise.exerciseName])
}

/** Warm-up ramp for the first working set of the exercise, rounded to plates for barbell lifts. */
export function useWarmupSteps(exercise: ActiveExercise, barWeight: number): WarmupStep[] {
  const kind = useExerciseKind(exercise)
  const workWeight = exercise.sets.find((set) => !isWarmup(set))?.weight ?? 0
  return useMemo(() => generateWarmupSets(workWeight, barWeight, kind), [barWeight, kind, workWeight])
}

function useAutoWarmupEnabled(exerciseId: string) {
  return useProfileStore((state) => state.profile?.preferences?.autoWarmupExerciseIds?.includes(exerciseId) ?? false)
}

/** "Gerar aquecimento" option + preview + the per-exercise automatic setting. */
export function WarmupOptions({ exercise, barWeight, onDone }: { exercise: ActiveExercise; barWeight: number; onDone: () => void }) {
  const insertWarmupSets = useSessionStore((state) => state.insertWarmupSets)
  const updatePreferences = useProfileStore((state) => state.updatePreferences)
  const autoIds = useProfileStore((state) => state.profile?.preferences?.autoWarmupExerciseIds)
  const auto = autoIds?.includes(exercise.exerciseId) ?? false
  const steps = useWarmupSteps(exercise, barWeight)
  const text = steps.map((step) => `${formatDecimal(step.weight)} kg × ${step.reps}`).join(' → ')

  return (
    <>
      <button
        type="button"
        disabled={steps.length === 0}
        onClick={() => { insertWarmupSets(exercise.exerciseId, steps); onDone() }}
        className={cn(OPTION_BUTTON, 'disabled:opacity-40')}
        aria-label={steps.length ? `Gerar aquecimento: ${steps.map((step) => `${formatDecimal(step.weight)} kg por ${step.reps}`).join(', ')}` : 'Gerar aquecimento (defina a carga primeiro)'}
      >
        <Flame size={16} aria-hidden />Gerar aquecimento
      </button>
      <div className="col-span-2 flex items-center justify-between gap-3 px-1">
        <span className="min-w-0">
          <span className="block text-[15px]">Aquecimento automático</span>
          <span className="footnote block text-[var(--muted)]">
            {steps.length > 0 ? text : 'Defina a carga da primeira série de trabalho.'}
          </span>
        </span>
        <Switch
          label={`Aquecimento automático em ${exercise.exerciseName}`}
          checked={auto}
          onChange={(checked) => {
            const current = autoIds ?? []
            void updatePreferences({
              autoWarmupExerciseIds: checked ? [...new Set([...current, exercise.exerciseId])] : current.filter((id) => id !== exercise.exerciseId),
            })
          }}
        />
      </div>
    </>
  )
}

/**
 * With the automatic setting on, keeps pending warm-ups in line with the first working
 * weight (debounced, so typing a load does not insert intermediate ramps).
 */
export function AutoWarmup({ exercise, barWeight }: { exercise: ActiveExercise; barWeight: number }) {
  const enabled = useAutoWarmupEnabled(exercise.exerciseId)
  const insertWarmupSets = useSessionStore((state) => state.insertWarmupSets)
  const steps = useWarmupSteps(exercise, barWeight)
  const workWeight = exercise.sets.find((set) => !isWarmup(set))?.weight ?? 0
  const warmupDone = exercise.sets.some((set) => isWarmup(set) && set.completed)
  const pendingWarmups = exercise.sets.some((set) => isWarmup(set) && !set.completed)
  const lastWeight = useRef<number | null>(exercise.warmupGenerated ? workWeight : null)
  const key = JSON.stringify(steps)

  useEffect(() => {
    if (!enabled || warmupDone || lastWeight.current === workWeight) return
    if (key === '[]' && !pendingWarmups) {
      lastWeight.current = workWeight
      return
    }
    const timer = setTimeout(() => {
      lastWeight.current = workWeight
      insertWarmupSets(exercise.exerciseId, JSON.parse(key) as WarmupStep[])
    }, 900)
    return () => clearTimeout(timer)
  }, [enabled, exercise.exerciseId, insertWarmupSets, key, pendingWarmups, warmupDone, workWeight])

  return null
}

/** Option button that opens the discomfort sheet. */
export function DiscomfortOption({ exercise }: { exercise: ActiveExercise }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn(OPTION_BUTTON, exercise.discomfort && 'text-[var(--warning)]')}>
        <Bandage size={16} aria-hidden />{exercise.discomfort ? 'Desconforto ✓' : 'Desconforto'}
      </button>
      {open && <DiscomfortSheet exercise={exercise} onClose={() => setOpen(false)} />}
    </>
  )
}

function DiscomfortSheet({ exercise, onClose }: { exercise: ActiveExercise; onClose: () => void }) {
  const setExerciseDiscomfort = useSessionStore((state) => state.setExerciseDiscomfort)
  const [location, setLocation] = useState<DiscomfortLocation>(exercise.discomfort?.location ?? 'ombro')
  const [intensity, setIntensity] = useState<DiscomfortNote['intensity']>(exercise.discomfort?.intensity ?? 1)
  const [note, setNote] = useState(exercise.discomfort?.note ?? '')

  return (
    <Modal open onClose={onClose} title="Dor ou desconforto">
      <p className="subhead mb-5 text-[var(--muted)]">
        Fica salvo com este treino em <strong className="text-[var(--foreground)]">{exercise.exerciseName}</strong>. Se repetir, o app avisa na próxima vez.
      </p>
      <div className="space-y-5">
        <fieldset>
          <legend className="mb-2 px-1 text-[13px] font-semibold text-[var(--muted)]">Onde</legend>
          <div className="flex flex-wrap gap-2">
            {DISCOMFORT_LOCATIONS.map((item) => (
              <button key={item.value} type="button" className="chip" aria-pressed={location === item.value} onClick={() => setLocation(item.value)}>{item.label}</button>
            ))}
          </div>
        </fieldset>
        <div>
          <p className="mb-2 px-1 text-[13px] font-semibold text-[var(--muted)]">Intensidade</p>
          <SegmentedControl
            label="Intensidade"
            value={String(intensity)}
            onChange={(value) => setIntensity(Number(value) as DiscomfortNote['intensity'])}
            options={DISCOMFORT_INTENSITIES.map((item) => ({ value: String(item.value), label: `${item.value} · ${item.label}` }))}
          />
        </div>
        <label className="block">
          <span className="mb-2 block px-1 text-[13px] font-semibold text-[var(--muted)]">Nota (opcional)</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={500} className="field resize-none py-3" placeholder="Ex.: pontada na descida, piora com pegada fechada" />
        </label>
        {intensity === 3 && (
          <p className="footnote rounded-[var(--radius-sm)] bg-[var(--warning-soft)] px-3.5 py-2.5 text-[var(--foreground)]">
            Dor forte: pare o exercício. Se persistir, procure um profissional de saúde.
          </p>
        )}
        <div className="flex gap-3">
          {exercise.discomfort && (
            <Button variant="secondary" className="flex-1" onClick={() => { setExerciseDiscomfort(exercise.exerciseId, null); onClose() }}>Remover</Button>
          )}
          <Button
            className="flex-1"
            onClick={() => {
              setExerciseDiscomfort(exercise.exerciseId, { location, intensity, ...(note.trim() ? { note: note.trim() } : {}) })
              onClose()
            }}
          >
            Salvar
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/**
 * Block plan for this week, progression suggestion and the repeated-discomfort warning,
 * shown at the top of an exercise card.
 */
export function ExerciseTrainingHints({ exercise, suggestion, barWeight, onReplace }: {
  exercise: ActiveExercise
  suggestion: ProgressionSuggestion | null
  barWeight: number
  onReplace: (exerciseId: string) => void
}) {
  const block = useProfileStore((state) => state.profile?.trainingBlock ?? null)
  const sessions = useProfileStore((state) => state.sessions)
  const allExercises = useWorkoutStore((state) => state.exercises)
  const workoutId = useSessionStore((state) => state.active?.workoutId ?? '')
  const sessionId = useSessionStore((state) => state.active?.sessionId)
  const config = useWorkoutStore((state) => state.workouts.find((item) => item.id === workoutId)?.exerciseConfigs?.find((item) => item.exerciseId === exercise.exerciseId))
  const applyExercisePlan = useSessionStore((state) => state.applyExercisePlan)
  const kind = useExerciseKind(exercise)

  const plan = useMemo(() => block ? planExerciseForWeek({
    block, workoutId, baseSets: config?.targetSets ?? 3, previousSets: exercise.previousSets ?? [],
    maxReps: exercise.targetMaxReps ?? 12, progression: exercise.progression, barbell: kind.barbell, barWeight,
  }) : null, [barWeight, block, config?.targetSets, exercise.previousSets, exercise.progression, exercise.targetMaxReps, kind.barbell, workoutId])
  const warning = useMemo(() => repeatedDiscomfort(exercise.exerciseId, sessions, { excludeSessionId: sessionId }), [exercise.exerciseId, sessionId, sessions])
  const stored = allExercises.find((item) => item.id === exercise.exerciseId)
  const alternatives = useMemo(() => (warning ? alternativesFor(stored, allExercises) : []), [allExercises, stored, warning])
  const applied = plan ? planMatchesSets(exercise.sets, plan) : false
  const firstWork = exercise.sets.find((set) => !isWarmup(set) && !set.completed)

  if (!plan && !warning && !suggestion && !exercise.discomfort) return null

  return (
    <div className="mb-3 space-y-2">
      {warning && (
        <div role="note" className="rounded-[var(--radius-sm)] bg-[var(--warning-soft)] px-3.5 py-3">
          <p className="footnote flex items-start gap-2 text-[var(--foreground)]">
            <TriangleAlert size={16} className="mt-0.5 flex-none text-[var(--warning)]" aria-hidden />
            <span>
              <strong className="font-semibold">Desconforto em {warning.count} das últimas {warning.window} sessões</strong>{' '}
              ({warning.locations.map(discomfortLocationLabel).join(', ').toLowerCase()}). Reduza a carga ou troque por uma alternativa
              {alternatives.length ? `: ${alternatives.map((item) => item.name).join(', ')}` : ''}.
            </span>
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {firstWork && firstWork.weight > 0 && (
              <button
                type="button"
                className="chip"
                onClick={() => applyExercisePlan(exercise.exerciseId, {
                  sets: exercise.sets.filter((set) => !isWarmup(set)).length,
                  weight: Math.max(0, Math.floor((firstWork.weight * 0.9) / 2.5) * 2.5),
                })}
              >
                Reduzir 10%
              </button>
            )}
            <button type="button" className="chip" onClick={() => onReplace(exercise.exerciseId)}><Replace size={13} aria-hidden />Trocar</button>
          </div>
        </div>
      )}

      {exercise.discomfort && (
        <p className="footnote flex items-center gap-1.5 px-1 text-[var(--warning)]">
          <Bandage size={14} aria-hidden />Desconforto registrado hoje: {describeDiscomfort(exercise.discomfort)}
        </p>
      )}

      {plan && (
        <div className={cn('rounded-[var(--radius-sm)] px-3.5 py-2.5', plan.deload ? 'bg-[color-mix(in_srgb,var(--success-fill)_12%,transparent)]' : 'bg-[var(--accent-soft)]')}>
          <div className="flex items-center gap-3">
            <p className="footnote min-w-0 flex-1 text-[var(--foreground)]">
              <span className="flex items-center gap-1.5 font-semibold">
                <CalendarRange size={14} aria-hidden />
                Bloco · semana {plan.weekNumber} de {plan.totalWeeks}{plan.deload ? ' · deload' : ''}
              </span>
              <span className="numeric block">
                {plan.sets} séries{plan.weight != null && plan.weight > 0 ? ` · ${formatDecimal(plan.weight)} kg` : ''}. {plan.reason}
              </span>
            </p>
            <button
              type="button"
              disabled={applied}
              onClick={() => applyExercisePlan(exercise.exerciseId, { sets: plan.sets, weight: plan.weight && plan.weight > 0 ? plan.weight : null })}
              className="pill flex-none disabled:!bg-[var(--fill)] disabled:!text-[var(--muted)] disabled:!opacity-100"
            >
              {applied ? 'Aplicado' : 'Aplicar'}
            </button>
          </div>
        </div>
      )}

      {suggestion && !plan?.deload && (
        <p className={cn('footnote rounded-[var(--radius-sm)] px-3.5 py-2.5', suggestion.progressed ? 'bg-[color-mix(in_srgb,var(--success-fill)_12%,transparent)] text-[var(--success)]' : 'bg-[var(--fill)] text-[var(--muted-strong)]')}>
          <strong className="font-semibold">{formatDecimal(suggestion.weight)} kg sugeridos.</strong> {suggestion.reason}
        </p>
      )}
    </div>
  )
}
