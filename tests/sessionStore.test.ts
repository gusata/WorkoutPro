import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearLocalData, db, initProfile } from '@/lib/db'
import { useSessionStore } from '@/stores/useSessionStore'
import { useTimerStore } from '@/stores/useTimerStore'

vi.mock('@/lib/timerPlugin', () => ({
  TimerPlugin: {
    startWorkout: vi.fn().mockResolvedValue(undefined), stopWorkout: vi.fn().mockResolvedValue(undefined),
    startTimer: vi.fn().mockResolvedValue(undefined), stopTimer: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('@/lib/notifications', () => ({ cancelRestNotification: vi.fn().mockResolvedValue(undefined) }))

describe('sessionStore', () => {
  beforeEach(async () => {
    await clearLocalData()
    await initProfile()
    useSessionStore.setState({ active: null })
    useTimerStore.setState({ workoutRunning: false, workoutStartedAt: null })
  })

  it('finaliza de forma idempotente e atualiza o perfil uma unica vez', async () => {
    const startedAt = new Date(Date.now() - 60_000)
    useSessionStore.setState({
      active: {
        sessionId: 'stable-session', workoutId: 'workout-1', workoutName: 'Treino A',
        workoutColor: '#00c896', startedAt, notes: '',
        exercises: [{
          exerciseId: 'exercise-1', exerciseName: 'Supino', muscleGroup: 'Peitoral', notes: '', restSeconds: 90,
          sets: [{ id: 'set-1', weight: 100, reps: 10, rpe: null, completed: true, completedAt: new Date() }],
        }],
      },
    })

    const [first, second] = await Promise.all([
      useSessionStore.getState().endSession(),
      useSessionStore.getState().endSession(),
    ])

    expect(first?.id).toBe('stable-session')
    expect(second?.id).toBe('stable-session')
    expect(await db.sessions.count()).toBe(1)
    const profile = await db.profile.get('profile')
    expect(profile?.totalWorkouts).toBe(1)
    expect(profile?.totalVolume).toBe(1000)
    expect(profile?.xp).toBe(95)
    expect(await db.syncQueue.count()).toBe(2)
  })

  it('reordena exercicios durante a execucao sem perder as series', () => {
    const startedAt = new Date()
    useSessionStore.setState({
      active: {
        sessionId: 'reorder-session', workoutId: 'workout-1', workoutName: 'Treino A',
        workoutColor: '#00c896', startedAt, notes: '',
        exercises: [
          { exerciseId: 'exercise-1', exerciseName: 'Supino', muscleGroup: 'Peitoral', restSeconds: 90, sets: [{ id: 'set-1', weight: 80, reps: 8, rpe: null, completed: false, completedAt: null }] },
          { exerciseId: 'exercise-2', exerciseName: 'Remada', muscleGroup: 'Costas', restSeconds: 90, sets: [{ id: 'set-2', weight: 70, reps: 10, rpe: null, completed: true, completedAt: new Date() }] },
        ],
      },
    })

    useSessionStore.getState().moveExercise('exercise-2', -1)

    const exercises = useSessionStore.getState().active?.exercises ?? []
    expect(exercises.map((exercise) => exercise.exerciseId)).toEqual(['exercise-2', 'exercise-1'])
    expect(exercises[0].sets[0].completed).toBe(true)
  })
})
