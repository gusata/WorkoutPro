import type { Exercise, Workout, WorkoutSession } from '@/types'

export interface ExerciseSessionEntry {
  sessionId: string
  workoutId: string
  workoutName: string
  date: Date
  duration: number
  sets: number
  volume: number
  bestWeight: number
  bestReps: number
  bestEstimatedOneRm: number
}

export interface ExerciseRecords {
  bestWeight: number
  bestReps: number
  bestVolume: number
  bestEstimatedOneRm: number
  totalVolume: number
  totalSets: number
  sessions: number
}

export function estimateOneRm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0
  return weight * (1 + reps / 30)
}

export function getExerciseHistory(
  exerciseId: string,
  sessions: WorkoutSession[],
  workouts: Workout[]
): ExerciseSessionEntry[] {
  const workoutNames = new Map(workouts.map((workout) => [workout.id, workout.name]))

  return sessions
    .filter((session) => session.finishedAt)
    .map((session) => {
      const exercise = session.exercises.find((item) => item.exerciseId === exerciseId)
      if (!exercise || exercise.sets.length === 0) return null

      const volume = exercise.sets.reduce((total, set) => total + set.weight * set.reps, 0)
      const bestWeight = Math.max(...exercise.sets.map((set) => set.weight))
      const bestReps = Math.max(...exercise.sets.map((set) => set.reps))
      const bestEstimatedOneRm = Math.max(...exercise.sets.map((set) => estimateOneRm(set.weight, set.reps)))

      return {
        sessionId: session.id,
        workoutId: session.workoutId,
        workoutName: workoutNames.get(session.workoutId) ?? 'Treino',
        date: new Date(session.finishedAt!),
        duration: session.duration,
        sets: exercise.sets.length,
        volume,
        bestWeight,
        bestReps,
        bestEstimatedOneRm,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b!.date.getTime() - a!.date.getTime()) as ExerciseSessionEntry[]
}

export function getExerciseRecords(history: ExerciseSessionEntry[]): ExerciseRecords {
  return history.reduce<ExerciseRecords>(
    (records, entry) => ({
      bestWeight: Math.max(records.bestWeight, entry.bestWeight),
      bestReps: Math.max(records.bestReps, entry.bestReps),
      bestVolume: Math.max(records.bestVolume, entry.volume),
      bestEstimatedOneRm: Math.max(records.bestEstimatedOneRm, entry.bestEstimatedOneRm),
      totalVolume: records.totalVolume + entry.volume,
      totalSets: records.totalSets + entry.sets,
      sessions: records.sessions + 1,
    }),
    {
      bestWeight: 0,
      bestReps: 0,
      bestVolume: 0,
      bestEstimatedOneRm: 0,
      totalVolume: 0,
      totalSets: 0,
      sessions: 0,
    }
  )
}

export function getExerciseRecordsById(
  exerciseId: string,
  sessions: WorkoutSession[],
  workouts: Workout[]
): ExerciseRecords {
  return getExerciseRecords(getExerciseHistory(exerciseId, sessions, workouts))
}

export function getBestExerciseRecord(
  exercises: Exercise[],
  sessions: WorkoutSession[],
  workouts: Workout[]
) {
  return exercises
    .map((exercise) => ({
      exercise,
      records: getExerciseRecordsById(exercise.id, sessions, workouts),
    }))
    .sort((a, b) => b.records.bestEstimatedOneRm - a.records.bestEstimatedOneRm)[0] ?? null
}
