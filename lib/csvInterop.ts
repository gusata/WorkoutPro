import { db } from '@/lib/db'
import { generateId } from '@/lib/utils'
import { queueSync } from '@/lib/syncQueue'
import { reconcileProfile } from '@/lib/profileStats'
import type { Exercise, Workout, WorkoutSession } from '@/types'

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []; let field = ''; let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '"' && quoted && text[index + 1] === '"') { field += '"'; index += 1 }
    else if (character === '"') quoted = !quoted
    else if (character === ',' && !quoted) { row.push(field); field = '' }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      row.push(field); if (row.some(Boolean)) rows.push(row); row = []; field = ''
    } else field += character
  }
  row.push(field); if (row.some(Boolean)) rows.push(row)
  return rows
}

function normalized(value: string) { return value.trim().toLowerCase().replace(/[\s-]+/g, '_') }
function cell(record: Record<string, string>, ...keys: string[]) { for (const key of keys) if (record[key]) return record[key]; return '' }
function number(value: string) { const parsed = Number(value.replace(',', '.')); return Number.isFinite(parsed) ? parsed : 0 }

export interface CsvImportPreview { workouts: number; exercises: number; sessions: number; sets: number }

export async function importTrainingCsv(text: string): Promise<CsvImportPreview> {
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error('CSV vazio')
  const headers = rows[0].map(normalized)
  const records = rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ''])))
  if (!headers.some((header) => ['exercise_name', 'exercise_title'].includes(header))) throw new Error('Formato Strong/Hevy não reconhecido')
  const existingExercises = await db.exercises.toArray(); const existingWorkouts = await db.workouts.toArray()
  const exercises = new Map(existingExercises.map((item) => [normalized(item.name), item]))
  const workouts = new Map(existingWorkouts.map((item) => [normalized(item.name), item]))
  const newExercises: Exercise[] = []; const newWorkouts: Workout[] = []; const sessionGroups = new Map<string, typeof records>()
  for (const record of records) {
    const title = cell(record, 'title', 'workout_name') || 'Treino importado'
    const start = cell(record, 'start_time', 'date') || new Date().toISOString()
    const key = `${title}|${start}`; sessionGroups.set(key, [...(sessionGroups.get(key) ?? []), record])
    const exerciseName = cell(record, 'exercise_title', 'exercise_name')
    if (exerciseName && !exercises.has(normalized(exerciseName))) {
      const now = new Date(); const exercise: Exercise = { id: generateId(), name: exerciseName, muscleGroup: 'Full Body', notes: cell(record, 'exercise_notes', 'notes'), createdAt: now, updatedAt: now }
      exercises.set(normalized(exerciseName), exercise); newExercises.push(exercise)
    }
  }
  const sessions: WorkoutSession[] = []
  for (const [key, group] of sessionGroups) {
    const [title] = key.split('|'); const now = new Date()
    let workout = workouts.get(normalized(title))
    const exerciseIds = [...new Set(group.map((record) => exercises.get(normalized(cell(record, 'exercise_title', 'exercise_name')))?.id).filter(Boolean))] as string[]
    if (!workout) { workout = { id: generateId(), name: title, color: '#e45d43', icon: 'Dumbbell', exerciseIds, createdAt: now, updatedAt: now }; workouts.set(normalized(title), workout); newWorkouts.push(workout) }
    const startValue = cell(group[0], 'start_time', 'date'); const endValue = cell(group[0], 'end_time')
    const startedAt = new Date(startValue); const safeStart = Number.isNaN(startedAt.getTime()) ? now : startedAt
    const finishedAt = endValue ? new Date(endValue) : new Date(safeStart.getTime() + number(cell(group[0], 'duration_seconds')) * 1000)
    const groupedExercises = new Map<string, typeof group>()
    for (const record of group) { const exercise = exercises.get(normalized(cell(record, 'exercise_title', 'exercise_name'))); if (exercise) groupedExercises.set(exercise.id, [...(groupedExercises.get(exercise.id) ?? []), record]) }
    const sessionExercises = [...groupedExercises].map(([exerciseId, sets]) => ({ exerciseId, sets: sets.map((record) => ({ id: generateId(), weight: number(cell(record, 'weight_kg', 'weight')), reps: number(cell(record, 'reps')), rpe: cell(record, 'rpe') ? number(cell(record, 'rpe')) : null, rir: null, setType: cell(record, 'set_type') === 'warmup' ? 'warmup' as const : 'normal' as const, completedAt: finishedAt })) }))
    const totalVolume = sessionExercises.flatMap((item) => item.sets).reduce((sum, set) => sum + set.weight * set.reps, 0)
    sessions.push({ id: generateId(), workoutId: workout.id, startedAt: safeStart, finishedAt, duration: Math.max(0, Math.floor((finishedAt.getTime() - safeStart.getTime()) / 1000)), exercises: sessionExercises, totalVolume, xpEarned: 0, notes: cell(group[0], 'description', 'workout_notes'), updatedAt: now })
  }
  await db.transaction('rw', [db.exercises, db.workouts, db.sessions, db.profile, db.syncQueue], async () => {
    if (newExercises.length) await db.exercises.bulkAdd(newExercises)
    if (newWorkouts.length) await db.workouts.bulkAdd(newWorkouts)
    if (sessions.length) await db.sessions.bulkAdd(sessions)
    for (const item of newExercises) await queueSync('exercises', item.id)
    for (const item of newWorkouts) await queueSync('workouts', item.id)
    for (const item of sessions) await queueSync('sessions', item.id)
    const profile = await db.profile.get('profile')
    if (profile) {
      const allSessions = await db.sessions.toArray()
      await db.profile.put(reconcileProfile(profile, allSessions))
      await queueSync('profile', 'profile')
    }
  })
  return { workouts: newWorkouts.length, exercises: newExercises.length, sessions: sessions.length, sets: sessions.flatMap((item) => item.exercises).flatMap((item) => item.sets).length }
}

function quote(value: unknown) { return `"${String(value ?? '').replace(/"/g, '""')}"` }
export function exportSessionsCsv(sessions: WorkoutSession[], workouts: Workout[], exercises: Exercise[]) {
  const workoutNames = new Map(workouts.map((item) => [item.id, item.name])); const exerciseNames = new Map(exercises.map((item) => [item.id, item.name]))
  const lines = [['title', 'start_time', 'end_time', 'exercise_title', 'set_index', 'set_type', 'weight_kg', 'reps', 'rpe']]
  for (const session of sessions) for (const exercise of session.exercises) exercise.sets.forEach((set, index) => lines.push([workoutNames.get(session.workoutId) ?? 'Treino', session.startedAt.toISOString(), session.finishedAt?.toISOString() ?? '', exerciseNames.get(exercise.exerciseId) ?? 'Exercício', String(index + 1), set.setType ?? 'normal', String(set.weight), String(set.reps), set.rpe == null ? '' : String(set.rpe)]))
  return lines.map((line) => line.map(quote).join(',')).join('\n')
}
