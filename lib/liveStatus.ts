import type { ActiveSession } from '@/types'
import type { LivePendingStep, LiveStatus } from '@/lib/timerPlugin'
import { formatDecimal } from '@/lib/utils'

/** The native side only needs the next few sets to chain "Série feita" taps while JS sleeps. */
export const MAX_PENDING_STEPS = 30

/** "What now / what next" for the Android ongoing notification (lock screen). */
export function buildLiveStatus(active: ActiveSession | null): LiveStatus | null {
  if (!active) return null
  const steps = active.exercises.flatMap((exercise) =>
    exercise.sets.map((set, index) => ({ exercise, set, index }))
  )
  const describe = (step: (typeof steps)[number] | undefined) => step
    ? `${step.exercise.exerciseName} · série ${step.index + 1} de ${step.exercise.sets.length} · ${formatDecimal(step.set.weight)} kg × ${step.set.reps}`
    : 'Último passo: finalizar o treino'
  const remaining = steps.filter((step) => !step.set.completed)
  const pending: LivePendingStep[] = remaining.slice(0, MAX_PENDING_STEPS).map((step) => ({
    exerciseId: step.exercise.exerciseId,
    setId: step.set.id,
    restSeconds: step.exercise.restSeconds ?? 90,
    label: describe(step),
  }))
  return {
    workoutName: active.workoutName,
    current: remaining.length === 0 ? 'Tudo feito. Finalize o treino.' : describe(remaining[0]),
    next: remaining.length === 0 ? 'Finalizar o treino' : describe(remaining[0]),
    doneSets: steps.length - remaining.length,
    totalSets: steps.length,
    pending,
  }
}
