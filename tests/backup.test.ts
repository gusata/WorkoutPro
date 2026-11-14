import { beforeEach, describe, expect, it } from 'vitest'
import { clearLocalData, db, initProfile } from '@/lib/db'
import { exportData, importData, parseBackup } from '@/lib/backup'
import { makeExercise, makeWorkout } from './fixtures'

describe('backup', () => {
  beforeEach(async () => {
    await clearLocalData()
    await initProfile()
  })

  it('rejeita arquivos incompletos antes de tocar no banco', async () => {
    const before = await db.profile.count()
    expect(() => parseBackup({ app: 'WorkoutPro', schemaVersion: 1, data: {} })).toThrow()
    expect(await db.profile.count()).toBe(before)
  })

  it('valida referencias e IDs duplicados', () => {
    const now = new Date().toISOString()
    const base = {
      workouts: [{ ...makeWorkout(), createdAt: now, updatedAt: now, exerciseIds: ['ausente'] }],
      exercises: [{ ...makeExercise(), createdAt: now, updatedAt: now }],
      sessions: [],
      measurements: [],
      profile: [{ ...(makeProfileJson(now)) }],
      achievements: [],
    }
    expect(() => parseBackup(base)).toThrow(/referencia um exercicio ausente/)
    expect(() => parseBackup({ ...base, workouts: [], exercises: [base.exercises[0], base.exercises[0]] })).toThrow(/ID duplicado/)
  })

  it('exporta, valida e importa atomicamente com fila individual', async () => {
    await db.exercises.add(makeExercise())
    await db.workouts.add(makeWorkout())
    const exported = await exportData()
    const parsed = parseBackup(JSON.parse(JSON.stringify(exported)))

    await clearLocalData()
    await importData(parsed)

    expect(await db.workouts.count()).toBe(1)
    expect((await db.workouts.get('workout-1'))?.createdAt).toBeInstanceOf(Date)
    expect(await db.syncQueue.count()).toBe(3)
    expect((await db.syncQueue.toArray()).every((item) => item.entityId !== '*')).toBe(true)
  })
})

function makeProfileJson(now: string) {
  return {
    id: 'profile', name: 'Atleta', level: 1, xp: 0, totalVolume: 0, totalWorkouts: 0,
    streak: 0, longestStreak: 0, lastWorkoutDate: null, createdAt: now, updatedAt: now,
  }
}
