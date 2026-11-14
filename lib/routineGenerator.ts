import type { Exercise, MuscleGroup, ProgressionRule, TrainingGoal, Workout, WorkoutExerciseConfig } from '@/types'
import {
  normalizeExerciseName,
  type EquipmentKind,
  type ExerciseCandidate,
  type Mechanic,
  type MovementPattern,
} from '@/lib/exerciseCandidates'

export type ExperienceLevel = 'iniciante' | 'intermediario' | 'avancado'

export interface GeneratorInput {
  daysPerWeek: number
  goal: TrainingGoal
  experience: ExperienceLevel
  /** Minutes per session. */
  sessionMinutes: number
  equipment: EquipmentKind[]
}

export interface GeneratedExercise {
  candidate: ExerciseCandidate
  /** Other candidates for the same slot (for swapping in the preview). */
  options: ExerciseCandidate[]
  sets: number
  minReps: number
  maxReps: number
  restSeconds: number
  progression: ProgressionRule
}

export interface GeneratedDay {
  key: string
  name: string
  color: string
  weekdays: number[]
  exercises: GeneratedExercise[]
}

export interface GeneratedPlan {
  split: SplitKind
  splitName: string
  description: string
  days: GeneratedDay[]
}

export type SplitKind = 'full-body' | 'upper-lower' | 'upper-lower-ppl' | 'ppl'

export const EXPERIENCE_OPTIONS: Array<{ value: ExperienceLevel; label: string }> = [
  { value: 'iniciante', label: 'Iniciante' },
  { value: 'intermediario', label: 'Intermediário' },
  { value: 'avancado', label: 'Avançado' },
]

interface Slot {
  pattern: MovementPattern
  muscleGroup: MuscleGroup
  mechanic: Mechanic
  /** Picks the n-th suitable candidate, so A/B days get different variations. */
  variant?: number
}

const S = (pattern: MovementPattern, muscleGroup: MuscleGroup, mechanic: Mechanic, variant = 0): Slot => ({ pattern, muscleGroup, mechanic, variant })

const SQUAT = (v = 0) => S('squat', 'Quadríceps', 'compound', v)
const HINGE = (v = 0) => S('hinge', 'Posterior', 'compound', v)
const LUNGE = (v = 0) => S('lunge', 'Quadríceps', 'compound', v)
const KNEE_EXT = S('knee-extension', 'Quadríceps', 'isolation')
const KNEE_FLEX = (v = 0) => S('knee-flexion', 'Posterior', 'isolation', v)
const GLUTE = S('glute', 'Glúteo', 'compound')
const CALF = (v = 0) => S('calf', 'Panturrilha', 'isolation', v)
const H_PUSH = (v = 0) => S('horizontal-push', 'Peitoral', 'compound', v)
const INCLINE = (v = 0) => S('incline-push', 'Peitoral', 'compound', v)
const FLY = S('chest-fly', 'Peitoral', 'isolation')
const V_PUSH = (v = 0) => S('vertical-push', 'Ombros', 'compound', v)
const LATERAL = (v = 0) => S('lateral-raise', 'Ombros', 'isolation', v)
const REAR = S('rear-delt', 'Ombros', 'isolation')
const H_PULL = (v = 0) => S('horizontal-pull', 'Costas', 'compound', v)
const V_PULL = (v = 0) => S('vertical-pull', 'Costas', 'compound', v)
const BICEPS = (v = 0) => S('biceps', 'Bíceps', 'isolation', v)
const TRICEPS = (v = 0) => S('triceps', 'Tríceps', 'isolation', v)
const CORE = (v = 0) => S('core', 'Abdômen', 'isolation', v)

// Slots in execution order; the time budget trims from the end.
const DAY_SLOTS: Record<string, Slot[]> = {
  fullA: [SQUAT(0), H_PUSH(0), H_PULL(0), V_PUSH(0), KNEE_FLEX(0), BICEPS(0), TRICEPS(0), CORE(0)],
  fullB: [HINGE(0), V_PULL(0), INCLINE(0), LUNGE(0), LATERAL(0), CALF(0), TRICEPS(1), CORE(1)],
  fullC: [SQUAT(1), H_PUSH(1), H_PULL(1), GLUTE, REAR, BICEPS(1), KNEE_EXT, CORE(0)],
  upperA: [H_PUSH(0), V_PULL(0), V_PUSH(0), H_PULL(0), LATERAL(0), TRICEPS(0), BICEPS(0), REAR],
  upperB: [INCLINE(0), H_PULL(1), V_PUSH(1), V_PULL(1), FLY, BICEPS(1), TRICEPS(1), LATERAL(1)],
  lowerA: [SQUAT(0), HINGE(1), LUNGE(0), KNEE_FLEX(0), CALF(0), CORE(0)],
  lowerB: [HINGE(0), SQUAT(1), GLUTE, KNEE_EXT, KNEE_FLEX(1), CALF(1), CORE(1)],
  push: [H_PUSH(0), INCLINE(0), V_PUSH(0), LATERAL(0), FLY, TRICEPS(0), TRICEPS(1)],
  pull: [V_PULL(0), H_PULL(0), H_PULL(1), REAR, BICEPS(0), BICEPS(1), CORE(0)],
  legs: [SQUAT(0), HINGE(1), LUNGE(0), KNEE_EXT, KNEE_FLEX(0), CALF(0)],
  pushB: [INCLINE(0), H_PUSH(1), V_PUSH(1), FLY, LATERAL(1), TRICEPS(1), TRICEPS(0)],
  pullB: [H_PULL(1), V_PULL(1), H_PULL(0), REAR, BICEPS(1), BICEPS(0), CORE(1)],
  legsB: [HINGE(0), SQUAT(1), GLUTE, KNEE_FLEX(1), KNEE_EXT, CALF(1), CORE(1)],
}

const DAY_NAMES: Record<string, string> = {
  fullA: 'Full Body A', fullB: 'Full Body B', fullC: 'Full Body C',
  upperA: 'Superior A', upperB: 'Superior B', lowerA: 'Inferior A', lowerB: 'Inferior B',
  push: 'Push A', pull: 'Pull A', legs: 'Legs A', pushB: 'Push B', pullB: 'Pull B', legsB: 'Legs B',
}

const DAY_COLORS = ['#6366f1', '#f43f5e', '#22c55e', '#f97316', '#06b6d4', '#8b5cf6']

/** Default weekdays (0 = domingo) spread across the week for each frequency. */
export const WEEKDAY_PATTERNS: Record<number, number[]> = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
}

export function chooseSplit(daysPerWeek: number): { split: SplitKind; name: string; description: string; days: string[] } {
  const days = Math.max(2, Math.min(6, Math.round(daysPerWeek)))
  if (days === 2) return { split: 'full-body', name: 'Full Body', description: 'Corpo inteiro em cada treino, alternando A e B.', days: ['fullA', 'fullB'] }
  if (days === 3) return { split: 'full-body', name: 'Full Body', description: 'Corpo inteiro três vezes por semana, com três variações.', days: ['fullA', 'fullB', 'fullC'] }
  if (days === 4) return { split: 'upper-lower', name: 'Superior / Inferior', description: 'Cada grupo duas vezes por semana em quatro treinos.', days: ['upperA', 'lowerA', 'upperB', 'lowerB'] }
  if (days === 5) return { split: 'upper-lower-ppl', name: 'Superior / Inferior + PPL', description: 'Superior e inferior no começo da semana, depois push, pull e legs.', days: ['upperA', 'lowerA', 'push', 'pull', 'legs'] }
  return { split: 'ppl', name: 'Push / Pull / Legs', description: 'Empurrar, puxar e pernas, duas vezes por semana.', days: ['push', 'pull', 'legs', 'pushB', 'pullB', 'legsB'] }
}

interface Prescription {
  sets: number
  minReps: number
  maxReps: number
  restSeconds: number
  progression: ProgressionRule
}

export function prescriptionFor(goal: TrainingGoal, experience: ExperienceLevel, mechanic: Mechanic): Prescription {
  const compound = mechanic === 'compound'
  const base: Prescription = goal === 'forca'
    ? compound
      ? { sets: 4, minReps: 3, maxReps: 6, restSeconds: 180, progression: { type: 'double-progression', increment: 2.5, minimumRir: 2 } }
      : { sets: 3, minReps: 8, maxReps: 12, restSeconds: 90, progression: { type: 'double-progression', increment: 1, minimumRir: 1 } }
    : goal === 'condicionamento'
      ? compound
        ? { sets: 3, minReps: 12, maxReps: 15, restSeconds: 60, progression: { type: 'double-progression', increment: 1, minimumRir: 2 } }
        : { sets: 2, minReps: 15, maxReps: 20, restSeconds: 45, progression: { type: 'double-progression', increment: 1, minimumRir: 2 } }
      : compound
        ? { sets: 3, minReps: 6, maxReps: 10, restSeconds: 120, progression: { type: 'double-progression', increment: 2.5, minimumRir: 1 } }
        : { sets: 3, minReps: 10, maxReps: 15, restSeconds: 75, progression: { type: 'double-progression', increment: 1, minimumRir: 1 } }
  const delta = experience === 'iniciante' ? -1 : experience === 'avancado' && compound ? 1 : 0
  return { ...base, sets: Math.max(2, base.sets + delta), progression: { ...base.progression } }
}

/** Rough minutes an exercise takes: sets × (≈45 s of work + rest) + 1.5 min of setup. */
export function estimateMinutes(item: Pick<GeneratedExercise, 'sets' | 'restSeconds'>) {
  return (item.sets * (45 + item.restSeconds)) / 60 + 1.5
}

export function estimateDayMinutes(day: Pick<GeneratedDay, 'exercises'>) {
  return Math.round(day.exercises.reduce((sum, item) => sum + estimateMinutes(item), 0) + 5)
}

function candidatesForSlot(slot: Slot, pool: ExerciseCandidate[], equipment: Set<EquipmentKind>) {
  const available = pool.filter((item) => equipment.has(item.equipment))
  const byPattern = available.filter((item) => item.pattern === slot.pattern)
  const fallback = available.filter((item) => !item.pattern && item.muscleGroup === slot.muscleGroup && item.mechanic === slot.mechanic)
  // The user's own exercises come first (they carry an id), then catalog order.
  return [...byPattern, ...fallback].sort((a, b) => Number(!a.id) - Number(!b.id))
}

/**
 * Builds a full split. Exercises never repeat inside a day; `variant` picks a different
 * option for B/C days when the equipment allows. Sessions are trimmed to the time budget
 * (at least 3 exercises).
 */
export function generateRoutine(input: GeneratorInput, pool: ExerciseCandidate[]): GeneratedPlan {
  const choice = chooseSplit(input.daysPerWeek)
  const equipment = new Set<EquipmentKind>([...input.equipment, 'peso-corporal'])
  const weekdays = WEEKDAY_PATTERNS[choice.days.length] ?? []
  const days = choice.days.map((key, index): GeneratedDay => {
    const used = new Set<string>()
    const exercises: GeneratedExercise[] = []
    for (const slot of DAY_SLOTS[key]) {
      const options = candidatesForSlot(slot, pool, equipment).filter((item) => !used.has(normalizeExerciseName(item.name)))
      if (options.length === 0) continue
      const candidate = options[Math.min(slot.variant ?? 0, options.length - 1)]
      used.add(normalizeExerciseName(candidate.name))
      exercises.push({ candidate, options, ...prescriptionFor(input.goal, input.experience, candidate.mechanic) })
    }
    const budget = Math.max(20, input.sessionMinutes) - 5
    while (exercises.length > 3 && exercises.reduce((sum, item) => sum + estimateMinutes(item), 0) > budget) exercises.pop()
    return {
      key: `${key}-${index}`,
      name: DAY_NAMES[key],
      color: DAY_COLORS[index % DAY_COLORS.length],
      weekdays: weekdays[index] != null ? [weekdays[index]] : [],
      exercises,
    }
  })
  return { split: choice.split, splitName: choice.name, description: choice.description, days }
}

export interface ResolvedPlan {
  /** Exercise records to create (unique by normalized name, absent from the user's list). */
  toCreate: ExerciseCandidate[]
  /** normalized name → existing exercise id. */
  existing: Map<string, string>
}

/** Which plan exercises already exist (by normalized name) and which must be created once. */
export function resolvePlanExercises(plan: Pick<GeneratedPlan, 'days'>, userExercises: Pick<Exercise, 'id' | 'name'>[]): ResolvedPlan {
  const existing = new Map<string, string>()
  for (const exercise of userExercises) {
    const key = normalizeExerciseName(exercise.name)
    if (!existing.has(key)) existing.set(key, exercise.id)
  }
  const toCreate = new Map<string, ExerciseCandidate>()
  for (const day of plan.days) {
    for (const item of day.exercises) {
      const key = normalizeExerciseName(item.candidate.name)
      if (!existing.has(key) && !toCreate.has(key)) toCreate.set(key, item.candidate)
    }
  }
  return { toCreate: [...toCreate.values()], existing }
}

/** Workout payloads for the plan, given the final normalized-name → id map. */
export function planToWorkouts(plan: Pick<GeneratedPlan, 'days'>, ids: Map<string, string>): Array<Omit<Workout, 'id' | 'createdAt' | 'updatedAt'>> {
  return plan.days.filter((day) => day.exercises.length > 0).map((day) => {
    const exerciseIds: string[] = []
    const exerciseConfigs: WorkoutExerciseConfig[] = []
    for (const item of day.exercises) {
      const id = ids.get(normalizeExerciseName(item.candidate.name))
      if (!id || exerciseIds.includes(id)) continue
      exerciseIds.push(id)
      exerciseConfigs.push({
        exerciseId: id, targetSets: item.sets, minReps: item.minReps, maxReps: Math.max(item.minReps, item.maxReps),
        restSeconds: item.restSeconds, supersetId: null, progression: item.progression,
      })
    }
    return { name: day.name.trim() || 'Treino', color: day.color, icon: 'Dumbbell', exerciseIds, exerciseConfigs, scheduledWeekdays: [...day.weekdays].sort((a, b) => a - b) }
  })
}

/** Notes put on exercises the generator creates. */
export function noteForCandidate(candidate: ExerciseCandidate) {
  return candidate.mechanic === 'compound'
    ? 'Criado pelo gerador de rotina. Registre carga, reps e ajuste usado; deixe 1-3 reps em reserva.'
    : 'Criado pelo gerador de rotina. Isolador: controle a volta e registre o ajuste usado.'
}
