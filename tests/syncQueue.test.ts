import { beforeEach, describe, expect, it } from 'vitest'
import { clearLocalData, db, initProfile } from '@/lib/db'
import { queueFullSync, queueSync } from '@/lib/syncQueue'
import { makeExercise, makeWorkout } from './fixtures'

describe('syncQueue', () => {
  beforeEach(async () => {
    await clearLocalData()
    await initProfile()
  })

  it('substitui uma mutacao antiga por um item imutavel novo', async () => {
    await queueSync('profile', 'profile')
    const first = await db.syncQueue.toArray()
    await queueSync('profile', 'profile')
    const second = await db.syncQueue.toArray()

    expect(second).toHaveLength(1)
    expect(second[0].id).not.toBe(first[0].id)
  })

  it('enfileira entidades reais sem sentinela curinga', async () => {
    await db.exercises.add(makeExercise())
    await db.workouts.add(makeWorkout())
    await queueFullSync()

    const items = await db.syncQueue.toArray()
    expect(items).toHaveLength(3)
    expect(items.map((item) => `${item.entity}:${item.entityId}`).sort()).toEqual([
      'exercises:exercise-1', 'profile:profile', 'workouts:workout-1',
    ])
  })

  it('preserva exclusoes pendentes ao enfileirar tudo de uma vez', async () => {
    await db.workouts.add(makeWorkout())
    await queueSync('exercises', 'exercise-removida', 'delete')
    await queueFullSync()

    const items = await db.syncQueue.toArray()
    expect(items.find((item) => item.entityId === 'exercise-removida')?.operation).toBe('delete')
    expect(items.filter((item) => item.entity === 'workouts')).toHaveLength(1)
  })
})
