import { beforeEach, describe, expect, it } from 'vitest'
import { clearLocalData, db } from '@/lib/db'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { makeExercise, makeWorkout } from './fixtures'

describe('workoutStore', () => {
  beforeEach(async () => {
    await clearLocalData()
    await db.exercises.add(makeExercise())
    await db.workouts.add(makeWorkout())
    useWorkoutStore.setState({
      exercises: [makeExercise()],
      workouts: [makeWorkout()],
      loaded: true,
    })
  })

  it('remove um exercicio das fichas e enfileira ambas as mudancas atomicamente', async () => {
    await useWorkoutStore.getState().deleteExercise('exercise-1')

    expect(await db.exercises.get('exercise-1')).toBeUndefined()
    expect((await db.workouts.get('workout-1'))?.exerciseIds).toEqual([])
    const queued = await db.syncQueue.toArray()
    expect(queued.map((item) => `${item.entity}:${item.operation}`).sort()).toEqual([
      'exercises:delete', 'workouts:upsert',
    ])
  })

  it('nao duplica um exercicio dentro do mesmo treino', async () => {
    await useWorkoutStore.getState().addExerciseToWorkout('workout-1', 'exercise-1')
    expect((await db.workouts.get('workout-1'))?.exerciseIds).toEqual(['exercise-1'])
    expect(await db.syncQueue.count()).toBe(0)
  })
})
