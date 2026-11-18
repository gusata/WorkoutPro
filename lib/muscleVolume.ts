import { differenceInCalendarDays, endOfWeek, getISODay, startOfWeek, subWeeks } from 'date-fns'
import { findLibraryMatch } from '@/lib/exerciseLibrary'
import type { CompletedSet, Exercise, MuscleGroup, MuscleTargetRange, UserPreferences, WorkoutSession } from '@/types'

/** Every trainable muscle (everything in MuscleGroup except 'Full Body'). */
export const MUSCLES: Exclude<MuscleGroup, 'Full Body'>[] = [
  'Peitoral', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Antebraço', 'Abdômen',
  'Trapézio', 'Lombar', 'Glúteo', 'Quadríceps', 'Posterior', 'Panturrilha',
]

/**
 * How sets are counted (documented in one place so the map, the bars and the
 * readiness all agree):
 * - Only hard working sets count: warm-up sets are ignored; normal, drop, failure
 *   and AMRAP sets count 1 each.
 * - The exercise's primary muscle gets 1 per set.
 * - Each secondary muscle (optional, e.g. from the exercise library) gets 0.5 per
 *   set — the common "fractional sets" convention for indirect work.
 * - A 'Full Body' exercise spreads 0.5 per set to every muscle.
 */
export const SECONDARY_SET_WEIGHT = 0.5
export const FULL_BODY_SET_WEIGHT = 0.5

/** Hypertrophy ranges per week; smaller muscles get more indirect work, so lower targets. */
const LARGE_TARGET: MuscleTargetRange = { min: 10, max: 20 }
const SMALL_TARGET: MuscleTargetRange = { min: 6, max: 12 }
export const DEFAULT_MUSCLE_TARGETS: Record<Exclude<MuscleGroup, 'Full Body'>, MuscleTargetRange> = {
  Peitoral: LARGE_TARGET,
  Costas: LARGE_TARGET,
  Ombros: LARGE_TARGET,
  Quadríceps: LARGE_TARGET,
  Posterior: LARGE_TARGET,
  Glúteo: LARGE_TARGET,
  Bíceps: SMALL_TARGET,
  Tríceps: SMALL_TARGET,
  Antebraço: SMALL_TARGET,
  Abdômen: SMALL_TARGET,
  Trapézio: SMALL_TARGET,
  Lombar: SMALL_TARGET,
  Panturrilha: SMALL_TARGET,
}

export type Muscle = (typeof MUSCLES)[number]

/** Reads secondary muscles from an exercise; by default an optional `secondaryMuscles` field. */
export type SecondaryResolver = (exercise: Exercise) => readonly MuscleGroup[] | null | undefined

const defaultSecondaries: SecondaryResolver = (exercise) => {
  const value = (exercise as Exercise & { secondaryMuscles?: unknown }).secondaryMuscles
  if (Array.isArray(value)) return value as MuscleGroup[]
  // Exercises linked to (or named like) a library entry inherit its secondary muscles.
  return findLibraryMatch(exercise)?.secondaryMuscles ?? null
}

export interface MuscleOptions {
  secondaryMuscles?: SecondaryResolver
}

export function isHardSet(set: Pick<CompletedSet, 'setType'>) {
  return (set.setType ?? 'normal') !== 'warmup'
}

/** Muscles an exercise trains and the weight each of its hard sets counts for. */
export function muscleContributions(exercise: Exercise, options: MuscleOptions = {}): Array<{ muscle: Muscle; weight: number }> {
  if (exercise.muscleGroup === 'Full Body') return MUSCLES.map((muscle) => ({ muscle, weight: FULL_BODY_SET_WEIGHT }))
  const result: Array<{ muscle: Muscle; weight: number }> = [{ muscle: exercise.muscleGroup, weight: 1 }]
  const secondaries = (options.secondaryMuscles ?? defaultSecondaries)(exercise) ?? []
  for (const muscle of secondaries) {
    if (muscle === 'Full Body' || result.some((item) => item.muscle === muscle)) continue
    result.push({ muscle, weight: SECONDARY_SET_WEIGHT })
  }
  return result
}

export interface MuscleExerciseVolume {
  exerciseId: string
  name: string
  /** Hard sets of this exercise (raw count). */
  sets: number
  /** Sets credited to the muscle (raw × weight). */
  credited: number
  primary: boolean
}

export interface MuscleVolume {
  muscle: Muscle
  sets: number
  exercises: MuscleExerciseVolume[]
}

function sessionDate(session: WorkoutSession) {
  return session.finishedAt ? new Date(session.finishedAt) : null
}

/** Hard sets per muscle between two dates (inclusive), with the exercises behind them. */
export function muscleVolumeInRange(
  sessions: WorkoutSession[],
  exercises: Exercise[],
  start: Date,
  end: Date,
  options: MuscleOptions = {}
): Map<Muscle, MuscleVolume> {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]))
  const contributions = new Map<string, Array<{ muscle: Muscle; weight: number }>>()
  const totals = new Map<Muscle, MuscleVolume>()
  for (const session of sessions) {
    const date = sessionDate(session)
    if (!date || date < start || date > end) continue
    for (const item of session.exercises) {
      const exercise = byId.get(item.exerciseId)
      if (!exercise) continue
      const sets = item.sets.filter(isHardSet).length
      if (sets === 0) continue
      if (!contributions.has(exercise.id)) contributions.set(exercise.id, muscleContributions(exercise, options))
      for (const { muscle, weight } of contributions.get(exercise.id)!) {
        const entry = totals.get(muscle) ?? { muscle, sets: 0, exercises: [] }
        entry.sets += sets * weight
        const row = entry.exercises.find((value) => value.exerciseId === exercise.id)
        if (row) {
          row.sets += sets
          row.credited += sets * weight
        } else {
          entry.exercises.push({ exerciseId: exercise.id, name: exercise.name, sets, credited: sets * weight, primary: weight === 1 })
        }
        totals.set(muscle, entry)
      }
    }
  }
  for (const entry of totals.values()) entry.exercises.sort((a, b) => b.credited - a.credited)
  return totals
}

/** 0 = none, 1 = 1–4, 2 = 5–9, 3 = 10–19, 4 = 20+ weekly hard sets. */
export function muscleIntensity(sets: number): 0 | 1 | 2 | 3 | 4 {
  if (sets <= 0) return 0
  if (sets < 5) return 1
  if (sets < 10) return 2
  if (sets < 20) return 3
  return 4
}

export const INTENSITY_LEGEND = ['0', '1–4', '5–9', '10–19', '20+'] as const

export function getMuscleTargets(preferences: UserPreferences | null | undefined): Record<Muscle, MuscleTargetRange> {
  const custom = preferences?.muscleTargets ?? {}
  return Object.fromEntries(MUSCLES.map((muscle) => {
    const value = custom[muscle]
    const valid = value && Number.isFinite(value.min) && Number.isFinite(value.max) && value.min >= 0 && value.max >= value.min
    return [muscle, valid ? { min: value.min, max: value.max } : DEFAULT_MUSCLE_TARGETS[muscle]]
  })) as Record<Muscle, MuscleTargetRange>
}

export type VolumeStatus = 'below' | 'within' | 'above'

export const STATUS_LABEL: Record<VolumeStatus, string> = { below: 'abaixo', within: 'na faixa', above: 'acima' }

export function volumeStatus(sets: number, target: MuscleTargetRange): VolumeStatus {
  if (sets < target.min) return 'below'
  if (sets > target.max) return 'above'
  return 'within'
}

export interface WeeklyMuscleRow extends MuscleVolume {
  target: MuscleTargetRange
  status: VolumeStatus
  /** Trained at least once in the four weeks before this one: part of the user's routine. */
  inRoutine: boolean
}

export function weekRange(now: Date, weeksAgo = 0) {
  const start = startOfWeek(subWeeks(now, weeksAgo), { weekStartsOn: 1 })
  return { start, end: endOfWeek(start, { weekStartsOn: 1 }) }
}

/** One row per muscle for the (Monday-based) week containing `now`, minus `weeksAgo`. */
export function weeklyMuscleReport(
  sessions: WorkoutSession[],
  exercises: Exercise[],
  targets: Record<Muscle, MuscleTargetRange>,
  now: Date = new Date(),
  weeksAgo = 0,
  options: MuscleOptions = {}
): WeeklyMuscleRow[] {
  const { start, end } = weekRange(now, weeksAgo)
  const week = muscleVolumeInRange(sessions, exercises, start, end, options)
  const before = muscleVolumeInRange(sessions, exercises, subWeeks(start, 4), new Date(start.getTime() - 1), options)
  return MUSCLES.map((muscle) => {
    const entry = week.get(muscle) ?? { muscle, sets: 0, exercises: [] }
    return {
      ...entry,
      target: targets[muscle],
      status: volumeStatus(entry.sets, targets[muscle]),
      inRoutine: (before.get(muscle)?.sets ?? 0) > 0 || entry.sets > 0,
    }
  })
}

export interface MuscleNudge {
  muscle: Muscle
  sets: number
  missing: number
  target: MuscleTargetRange
  message: string
}

/**
 * From Thursday on, the routine muscle furthest below its minimum this week.
 * Muscles never trained in the last month are skipped (not part of the plan).
 */
export function lateWeekNudge(rows: WeeklyMuscleRow[], now: Date = new Date()): MuscleNudge | null {
  if (getISODay(now) < 4) return null
  const candidate = rows
    .filter((row) => row.inRoutine && row.status === 'below')
    .map((row) => ({ row, missing: row.target.min - row.sets }))
    .sort((a, b) => b.missing / b.row.target.min - a.missing / a.row.target.min || b.missing - a.missing)[0]
  if (!candidate) return null
  const missing = Math.ceil(candidate.missing)
  const sets = Math.round(candidate.row.sets * 10) / 10
  const daysLeft = 7 - getISODay(now)
  return {
    muscle: candidate.row.muscle,
    sets,
    missing,
    target: candidate.row.target,
    message: `${candidate.row.muscle}: ${formatSets(sets)} de ${candidate.row.target.min} séries nesta semana. ${daysLeft > 0 ? `Faltam ${missing} ${missing === 1 ? 'série' : 'séries'} e ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}.` : `Faltaram ${missing}.`}`,
  }
}

export function formatSets(value: number) {
  const rounded = Math.round(value * 10) / 10
  return String(rounded).replace('.', ',')
}

export interface MuscleRecency {
  muscle: Muscle
  /** Calendar days since the last session with 3+ credited hard sets for the muscle. */
  daysSince: number
  sets: number
}

/** Last "hard" session (3+ credited sets) per muscle within the last `lookbackDays`. */
export function lastHardSessionByMuscle(
  sessions: WorkoutSession[],
  exercises: Exercise[],
  now: Date = new Date(),
  lookbackDays = 14,
  options: MuscleOptions = {}
): MuscleRecency[] {
  const result = new Map<Muscle, MuscleRecency>()
  const recent = sessions
    .filter((session) => {
      const date = sessionDate(session)
      return date && date <= now && differenceInCalendarDays(now, date) <= lookbackDays
    })
    .sort((a, b) => sessionDate(b)!.getTime() - sessionDate(a)!.getTime())
  for (const session of recent) {
    const date = sessionDate(session)!
    const volume = muscleVolumeInRange([session], exercises, date, date, options)
    for (const entry of volume.values()) {
      if (entry.sets < 3 || result.has(entry.muscle)) continue
      result.set(entry.muscle, { muscle: entry.muscle, daysSince: differenceInCalendarDays(now, date), sets: entry.sets })
    }
  }
  return [...result.values()].sort((a, b) => a.daysSince - b.daysSince || b.sets - a.sets)
}
