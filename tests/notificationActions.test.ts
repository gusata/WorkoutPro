import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyNotificationActions, createActionDrainer } from '@/lib/notificationActions'
import type { NotificationAction } from '@/lib/timerPlugin'
import { useSessionStore } from '@/stores/useSessionStore'
import { useTimerStore } from '@/stores/useTimerStore'
import type { ActiveSession } from '@/types'

vi.mock('@/lib/timerPlugin', () => ({
  TimerPlugin: {
    startWorkout: vi.fn().mockResolvedValue(undefined), stopWorkout: vi.fn().mockResolvedValue(undefined),
    startTimer: vi.fn().mockResolvedValue(undefined), stopTimer: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('@/lib/notifications', () => ({
  scheduleRestEndNotification: vi.fn().mockResolvedValue(undefined),
  cancelRestNotification: vi.fn().mockResolvedValue(undefined),
}))

const START = new Date('2026-08-19T18:00:00-03:00')

function session(): ActiveSession {
  return {
    sessionId: 's1', workoutId: 'w1', workoutName: 'Treino A', workoutColor: '#0071e3', startedAt: START, notes: '',
    exercises: [{
      exerciseId: 'e1', exerciseName: 'Supino', muscleGroup: 'Peitoral', notes: '', restSeconds: 90,
      sets: [
        { id: 'set-1', weight: 80, reps: 10, rpe: null, completed: false, completedAt: null },
        { id: 'set-2', weight: 80, reps: 10, rpe: null, completed: false, completedAt: null },
      ],
    }],
  }
}

const targets = {
  getActive: () => useSessionStore.getState().active,
  completeSet: (exerciseId: string, setId: string) => useSessionStore.getState().completeSet(exerciseId, setId),
  updateSet: (exerciseId: string, setId: string, updates: object) => useSessionStore.getState().updateSet(exerciseId, setId, updates),
  syncRest: (endAt: number | null, total?: number) => useTimerStore.getState().syncRestFromNative(endAt, total),
}

function setOf(id: string) {
  return useSessionStore.getState().active!.exercises[0].sets.find((item) => item.id === id)!
}

describe('notification actions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(START.getTime() + 10 * 60_000))
    useSessionStore.setState({ active: session() })
    useTimerStore.setState({ restSeconds: 0, restTotal: 0, restRunning: false, restEndAt: null, workoutStartedAt: START.getTime() })
  })

  it('marca a serie feita e espelha o descanso iniciado na notificacao', () => {
    const at = Date.now() - 2000
    const action: NotificationAction = {
      id: 'a1', type: 'completeSet', at, workoutStartedAt: START.getTime(),
      exerciseId: 'e1', setId: 'set-1', restEndAt: at + 90_000, restTotal: 90,
    }
    expect(applyNotificationActions([action], targets, new Set())).toBe(1)
    expect(setOf('set-1').completed).toBe(true)
    expect(new Date(setOf('set-1').completedAt!).getTime()).toBe(at)
    expect(setOf('set-2').completed).toBe(false)
    const timer = useTimerStore.getState()
    expect(timer.restRunning).toBe(true)
    expect(timer.restEndAt).toBe(at + 90_000)
    expect(timer.restSeconds).toBe(88)
    expect(timer.restTotal).toBe(90)
  })

  it('e idempotente: o mesmo id ou uma serie ja feita nao desmarcam nada', () => {
    const seen = new Set<string>()
    const action: NotificationAction = {
      id: 'a1', type: 'completeSet', at: Date.now(), workoutStartedAt: START.getTime(), exerciseId: 'e1', setId: 'set-1',
    }
    applyNotificationActions([action, action], targets, seen)
    applyNotificationActions([action], targets, seen)
    expect(setOf('set-1').completed).toBe(true)
    // A different id for a set that is already done (e.g. completed in the app too) keeps it done.
    applyNotificationActions([{ ...action, id: 'a2' }], targets, seen)
    expect(setOf('set-1').completed).toBe(true)
  })

  it('aplica +15 s e pular descanso na ordem dos toques', () => {
    const now = Date.now()
    const base = { workoutStartedAt: START.getTime(), at: now }
    applyNotificationActions([
      { ...base, id: 'c', type: 'completeSet', exerciseId: 'e1', setId: 'set-1', restEndAt: now + 60_000, restTotal: 60 },
      { ...base, id: 'x', type: 'extendRest', restEndAt: now + 75_000, restTotal: 75 },
    ], targets, new Set())
    expect(useTimerStore.getState().restEndAt).toBe(now + 75_000)
    expect(useTimerStore.getState().restTotal).toBe(75)

    applyNotificationActions([{ ...base, id: 's', type: 'skipRest' }], targets, new Set())
    expect(useTimerStore.getState().restRunning).toBe(false)
  })

  it('descanso que ja terminou enquanto o app dormia nao volta a contar', () => {
    const now = Date.now()
    applyNotificationActions([{
      id: 'old', type: 'completeSet', at: now - 120_000, workoutStartedAt: START.getTime(),
      exerciseId: 'e1', setId: 'set-1', restEndAt: now - 30_000, restTotal: 90,
    }], targets, new Set())
    expect(setOf('set-1').completed).toBe(true)
    expect(useTimerStore.getState().restRunning).toBe(false)
  })

  it('descarta acoes de outra sessao ou sem sessao ativa', () => {
    const action: NotificationAction = {
      id: 'a1', type: 'completeSet', at: Date.now(), workoutStartedAt: START.getTime() - 86_400_000, exerciseId: 'e1', setId: 'set-1',
    }
    expect(applyNotificationActions([action], targets, new Set())).toBe(0)
    expect(setOf('set-1').completed).toBe(false)
    useSessionStore.setState({ active: null })
    expect(applyNotificationActions([{ ...action, id: 'a2', workoutStartedAt: START.getTime() }], targets, new Set())).toBe(0)
  })

  it('drena a fila uma vez mesmo com chamadas simultaneas', async () => {
    vi.useRealTimers()
    const queue: NotificationAction[] = [{
      id: 'a1', type: 'completeSet', at: Date.now(), workoutStartedAt: START.getTime(), exerciseId: 'e1', setId: 'set-1',
    }]
    // Like the native side: returns the queue and clears it.
    const consume = vi.fn(async () => ({ actions: queue.splice(0) }))
    const drain = createActionDrainer(consume, targets)
    const results = await Promise.all([drain(), drain(), drain()])
    expect(results.reduce((sum, value) => sum + value, 0)).toBe(1)
    expect(consume).toHaveBeenCalledTimes(3)
    expect(setOf('set-1').completed).toBe(true)
  })

  it('continua drenando depois de uma falha do plugin', async () => {
    vi.useRealTimers()
    const consume = vi.fn()
      .mockRejectedValueOnce(new Error('bridge'))
      .mockResolvedValueOnce({ actions: [{ id: 'a1', type: 'skipRest', at: Date.now(), workoutStartedAt: START.getTime() }] })
    const drain = createActionDrainer(consume, targets)
    await expect(drain()).rejects.toThrow('bridge')
    await expect(drain()).resolves.toBe(1)
  })
})
