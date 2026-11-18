import { differenceInCalendarDays, format, startOfDay } from 'date-fns'
import { estimateOneRm } from '@/lib/exerciseHistory'
import { muscleVolumeInRange } from '@/lib/muscleVolume'
import type { CompletedSet, Exercise, MuscleGroup, Workout, WorkoutSession } from '@/types'

function isWorkSet(set: Pick<CompletedSet, 'setType'>) {
  return (set.setType ?? 'normal') !== 'warmup'
}

function finished(sessions: WorkoutSession[]) {
  return sessions.filter((session) => session.finishedAt)
}

// ---------------------------------------------------------------------------
// Muscle map
// ---------------------------------------------------------------------------

/**
 * Hard (non warm-up) sets per muscle group between two dates. Counting rules
 * (secondary muscles, full body) live in lib/muscleVolume.ts.
 */
export function muscleSetsInRange(
  sessions: WorkoutSession[],
  exercises: Exercise[],
  start: Date,
  end: Date
): Map<MuscleGroup, number> {
  const volume = muscleVolumeInRange(finished(sessions), exercises, start, end)
  return new Map([...volume].map(([muscle, entry]) => [muscle as MuscleGroup, entry.sets]))
}

/** 0 = untrained, 1 = below maintenance (<6), 2 = productive (6-11), 3 = high (12+ weekly sets). */
export function muscleLevel(sets: number): 0 | 1 | 2 | 3 {
  if (sets <= 0) return 0
  if (sets < 6) return 1
  if (sets < 12) return 2
  return 3
}

// ---------------------------------------------------------------------------
// Personal records
// ---------------------------------------------------------------------------

export interface ExerciseBest {
  oneRm: number
  weight: number
}

export function bestsByExercise(sessions: WorkoutSession[], excludeSessionId?: string): Map<string, ExerciseBest> {
  const bests = new Map<string, ExerciseBest>()
  for (const session of sessions) {
    if (session.id === excludeSessionId) continue
    for (const item of session.exercises) {
      for (const set of item.sets) {
        if (!isWorkSet(set)) continue
        const current = bests.get(item.exerciseId) ?? { oneRm: 0, weight: 0 }
        bests.set(item.exerciseId, {
          oneRm: Math.max(current.oneRm, estimateOneRm(set.weight, set.reps)),
          weight: Math.max(current.weight, set.weight),
        })
      }
    }
  }
  return bests
}

export type RecordKind = 'oneRm' | 'weight'

/** Which record (if any) a set beats compared to the stored bests. */
export function recordForSet(best: ExerciseBest | undefined, weight: number, reps: number): RecordKind | null {
  if (!best || weight <= 0 || reps <= 0) return null
  if (weight > best.weight && best.weight > 0) return 'weight'
  if (estimateOneRm(weight, reps) > best.oneRm + 0.01 && best.oneRm > 0) return 'oneRm'
  return null
}

// ---------------------------------------------------------------------------
// Strength trend
// ---------------------------------------------------------------------------

export interface TrendPoint {
  date: Date
  value: number
}

/** Least-squares slope expressed in units per 30 days. */
export function trendPer30Days(points: TrendPoint[]): number | null {
  if (points.length < 2) return null
  const origin = points[0].date.getTime()
  const xs = points.map((point) => (point.date.getTime() - origin) / 86_400_000)
  const ys = points.map((point) => point.value)
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length
  let numerator = 0
  let denominator = 0
  xs.forEach((x, index) => {
    numerator += (x - meanX) * (ys[index] - meanY)
    denominator += (x - meanX) ** 2
  })
  if (denominator === 0) return null
  return (numerator / denominator) * 30
}

// ---------------------------------------------------------------------------
// Deload
// ---------------------------------------------------------------------------

export interface DecliningExercise {
  exerciseId: string
  name: string
  dropPct: number
}

export interface DeloadAdvice {
  suggested: boolean
  declining: DecliningExercise[]
}

/**
 * An exercise is "declining" when its best estimated 1RM fell in each of the last
 * two sessions (3 data points in the last 4 weeks) by 3%+ overall. Two or more
 * declining lifts — or one when it's the only lift being tracked — suggest a deload.
 */
export function getDeloadAdvice(sessions: WorkoutSession[], exercises: Exercise[], now: Date = new Date()): DeloadAdvice {
  const names = new Map(exercises.map((exercise) => [exercise.id, exercise.name]))
  const series = new Map<string, TrendPoint[]>()
  const recent = finished(sessions)
    .filter((session) => differenceInCalendarDays(now, new Date(session.finishedAt!)) <= 28)
    .sort((a, b) => new Date(a.finishedAt!).getTime() - new Date(b.finishedAt!).getTime())
  for (const session of recent) {
    for (const item of session.exercises) {
      const best = Math.max(0, ...item.sets.filter(isWorkSet).map((set) => estimateOneRm(set.weight, set.reps)))
      if (best <= 0) continue
      series.set(item.exerciseId, [...(series.get(item.exerciseId) ?? []), { date: new Date(session.finishedAt!), value: best }])
    }
  }
  const declining: DecliningExercise[] = []
  let tracked = 0
  for (const [exerciseId, points] of series) {
    if (points.length < 3) continue
    tracked += 1
    const [a, b, c] = points.slice(-3).map((point) => point.value)
    const dropPct = ((a - c) / a) * 100
    if (b < a && c < b && dropPct >= 3) {
      declining.push({ exerciseId, name: names.get(exerciseId) ?? 'Exercício', dropPct: Math.round(dropPct) })
    }
  }
  declining.sort((x, y) => y.dropPct - x.dropPct)
  const suggested = declining.length >= 2 || (declining.length === 1 && tracked === 1)
  return { suggested, declining }
}

// ---------------------------------------------------------------------------
// Consistency heatmap
// ---------------------------------------------------------------------------

export function setsByDay(sessions: WorkoutSession[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const session of finished(sessions)) {
    const key = format(new Date(session.finishedAt!), 'yyyy-MM-dd')
    const sets = session.exercises.reduce((total, item) => total + item.sets.length, 0)
    map.set(key, (map.get(key) ?? 0) + Math.max(sets, 1))
  }
  return map
}

export function heatLevel(sets: number): 0 | 1 | 2 | 3 | 4 {
  if (sets <= 0) return 0
  if (sets < 10) return 1
  if (sets < 18) return 2
  if (sets < 26) return 3
  return 4
}

// ---------------------------------------------------------------------------
// Recap ("Wrapped")
// ---------------------------------------------------------------------------

export interface Recap {
  sessions: number
  volume: number
  seconds: number
  sets: number
  activeDays: number
  longestStreak: number
  topExercise: { name: string; sets: number } | null
  topMuscle: { name: MuscleGroup; sets: number } | null
  favoriteWeekday: { index: number; count: number } | null
  favoriteWorkout: { name: string; count: number } | null
  records: number
  heaviest: { name: string; weight: number } | null
}

export function buildRecap(
  sessions: WorkoutSession[],
  workouts: Workout[],
  exercises: Exercise[],
  start: Date,
  end: Date
): Recap {
  const all = finished(sessions)
  const inRange = all.filter((session) => {
    const date = new Date(session.finishedAt!)
    return date >= start && date <= end
  })
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]))
  const workoutById = new Map(workouts.map((workout) => [workout.id, workout]))
  const setsPerExercise = new Map<string, number>()
  const weekdays = new Array(7).fill(0) as number[]
  const workoutCount = new Map<string, number>()
  let heaviest: Recap['heaviest'] = null
  let sets = 0

  for (const session of inRange) {
    weekdays[new Date(session.finishedAt!).getDay()] += 1
    workoutCount.set(session.workoutId, (workoutCount.get(session.workoutId) ?? 0) + 1)
    for (const item of session.exercises) {
      const work = item.sets.filter(isWorkSet)
      sets += work.length
      setsPerExercise.set(item.exerciseId, (setsPerExercise.get(item.exerciseId) ?? 0) + work.length)
      for (const set of work) {
        if (!heaviest || set.weight > heaviest.weight) {
          heaviest = { name: exerciseById.get(item.exerciseId)?.name ?? 'Exercício', weight: set.weight }
        }
      }
    }
  }

  // Records: sets in range that beat everything logged before them.
  let records = 0
  const running = bestsByExercise(all.filter((session) => new Date(session.finishedAt!) < start))
  for (const session of [...inRange].sort((a, b) => new Date(a.finishedAt!).getTime() - new Date(b.finishedAt!).getTime())) {
    for (const item of session.exercises) {
      const best = running.get(item.exerciseId)
      const sessionBest = Math.max(0, ...item.sets.filter(isWorkSet).map((set) => estimateOneRm(set.weight, set.reps)))
      if (best && sessionBest > best.oneRm + 0.01) records += 1
      running.set(item.exerciseId, {
        oneRm: Math.max(best?.oneRm ?? 0, sessionBest),
        weight: Math.max(best?.weight ?? 0, ...item.sets.map((set) => set.weight)),
      })
    }
  }

  const dayKeys = [...new Set(inRange.map((session) => startOfDay(new Date(session.finishedAt!)).getTime()))].sort((a, b) => a - b)
  let longestStreak = 0
  let run = 0
  dayKeys.forEach((day, index) => {
    run = index > 0 && differenceInCalendarDays(new Date(day), new Date(dayKeys[index - 1])) === 1 ? run + 1 : 1
    longestStreak = Math.max(longestStreak, run)
  })

  const topExerciseEntry = [...setsPerExercise.entries()].sort((a, b) => b[1] - a[1])[0]
  const muscles = muscleSetsInRange(inRange, exercises, start, end)
  const topMuscleEntry = [...muscles.entries()].sort((a, b) => b[1] - a[1])[0]
  const weekdayMax = Math.max(...weekdays)
  const topWorkoutEntry = [...workoutCount.entries()].sort((a, b) => b[1] - a[1])[0]

  return {
    sessions: inRange.length,
    volume: inRange.reduce((total, session) => total + session.totalVolume, 0),
    seconds: inRange.reduce((total, session) => total + session.duration, 0),
    sets,
    activeDays: dayKeys.length,
    longestStreak,
    topExercise: topExerciseEntry && topExerciseEntry[1] > 0
      ? { name: exerciseById.get(topExerciseEntry[0])?.name ?? 'Exercício', sets: topExerciseEntry[1] }
      : null,
    topMuscle: topMuscleEntry ? { name: topMuscleEntry[0], sets: Math.round(topMuscleEntry[1]) } : null,
    favoriteWeekday: weekdayMax > 0 ? { index: weekdays.indexOf(weekdayMax), count: weekdayMax } : null,
    favoriteWorkout: topWorkoutEntry
      ? { name: workoutById.get(topWorkoutEntry[0])?.name ?? 'Treino', count: topWorkoutEntry[1] }
      : null,
    records,
    heaviest,
  }
}

/** A tangible comparison for a lifted volume ("3 elefantes"). */
export function volumeComparison(kg: number): string | null {
  const items: Array<[number, string, string]> = [
    [180_000, 'baleia-azul', 'baleias-azuis'],
    [6_000, 'elefante', 'elefantes'],
    [1_500, 'carro', 'carros'],
    [450, 'piano de cauda', 'pianos de cauda'],
  ]
  for (const [weight, singular, plural] of items) {
    const count = kg / weight
    if (count >= 1) {
      const rounded = count >= 10 ? Math.round(count) : Math.round(count * 10) / 10
      return `${rounded.toLocaleString('pt-BR')} ${rounded === 1 ? singular : plural}`
    }
  }
  return null
}
