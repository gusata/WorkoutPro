import type { DiscomfortLocation, DiscomfortNote, Exercise, WorkoutSession } from '@/types'

export const DISCOMFORT_LOCATIONS: Array<{ value: DiscomfortLocation; label: string }> = [
  { value: 'ombro', label: 'Ombro' },
  { value: 'cotovelo', label: 'Cotovelo' },
  { value: 'punho', label: 'Punho' },
  { value: 'lombar', label: 'Lombar' },
  { value: 'quadril', label: 'Quadril' },
  { value: 'joelho', label: 'Joelho' },
  { value: 'pescoco', label: 'Pescoço' },
  { value: 'outro', label: 'Outro' },
]

export const DISCOMFORT_INTENSITIES: Array<{ value: DiscomfortNote['intensity']; label: string }> = [
  { value: 1, label: 'Leve' },
  { value: 2, label: 'Moderado' },
  { value: 3, label: 'Forte' },
]

export function discomfortLocationLabel(location: DiscomfortLocation) {
  return DISCOMFORT_LOCATIONS.find((item) => item.value === location)?.label ?? 'Outro'
}

export function discomfortIntensityLabel(intensity: number) {
  return DISCOMFORT_INTENSITIES.find((item) => item.value === intensity)?.label ?? 'Leve'
}

export function describeDiscomfort(note: DiscomfortNote) {
  return `${discomfortLocationLabel(note.location)} · ${discomfortIntensityLabel(note.intensity).toLowerCase()}`
}

/** Validates an unknown value (backup/cloud) into a discomfort note, or null. */
export function parseDiscomfort(value: unknown): DiscomfortNote | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  const location = DISCOMFORT_LOCATIONS.find((item) => item.value === record.location)?.value
  const intensity = record.intensity === 1 || record.intensity === 2 || record.intensity === 3 ? record.intensity : null
  if (!location || !intensity) return null
  const note = typeof record.note === 'string' && record.note.trim() ? record.note.trim().slice(0, 500) : undefined
  return { location, intensity, ...(note ? { note } : {}) }
}

export interface DiscomfortEntry {
  sessionId: string
  date: Date
  discomfort: DiscomfortNote
}

/** Finished sessions that included the exercise, newest first. */
function sessionsWithExercise(exerciseId: string, sessions: WorkoutSession[], excludeSessionId?: string) {
  return sessions
    .filter((session) => session.finishedAt && session.id !== excludeSessionId)
    .filter((session) => session.exercises.some((item) => item.exerciseId === exerciseId && (item.sets.length > 0 || item.discomfort)))
    .sort((a, b) => new Date(b.finishedAt!).getTime() - new Date(a.finishedAt!).getTime())
}

/** Every discomfort flag on the exercise, newest first. */
export function discomfortHistory(exerciseId: string, sessions: WorkoutSession[]): DiscomfortEntry[] {
  return sessionsWithExercise(exerciseId, sessions).flatMap((session) => {
    const discomfort = session.exercises.find((item) => item.exerciseId === exerciseId && item.discomfort)?.discomfort
    return discomfort ? [{ sessionId: session.id, date: new Date(session.finishedAt!), discomfort }] : []
  })
}

export interface DiscomfortWarning {
  /** Flagged sessions among the last `window` sessions of the exercise. */
  count: number
  window: number
  latest: DiscomfortNote
  locations: DiscomfortLocation[]
}

/**
 * Warn when the exercise had discomfort in at least `threshold` of its last `window`
 * sessions (default: 2 of the last 3).
 */
export function repeatedDiscomfort(
  exerciseId: string,
  sessions: WorkoutSession[],
  options: { window?: number; threshold?: number; excludeSessionId?: string } = {}
): DiscomfortWarning | null {
  const window = options.window ?? 3
  const threshold = options.threshold ?? 2
  const recent = sessionsWithExercise(exerciseId, sessions, options.excludeSessionId).slice(0, window)
  const notes = recent
    .map((session) => session.exercises.find((item) => item.exerciseId === exerciseId && item.discomfort)?.discomfort)
    .filter((note): note is DiscomfortNote => Boolean(note))
  if (notes.length < threshold) return null
  return {
    count: notes.length,
    window: recent.length,
    latest: notes[0],
    locations: [...new Set(notes.map((note) => note.location))],
  }
}

function normalized(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** The exercise's registered alternatives that exist as exercises, then same muscle group ones. */
export function alternativesFor(exercise: Exercise | undefined, exercises: Exercise[], limit = 3): Exercise[] {
  if (!exercise) return []
  const names = new Set((exercise.alternatives ?? []).map(normalized))
  const registered = exercises.filter((item) => item.id !== exercise.id && names.has(normalized(item.name)))
  const sameGroup = exercises.filter((item) => item.id !== exercise.id && !registered.includes(item) && item.muscleGroup === exercise.muscleGroup)
  return [...registered, ...sameGroup].slice(0, limit)
}
