import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTimerStore } from '@/stores/useTimerStore'

vi.mock('@/lib/timerPlugin', () => ({
  TimerPlugin: {
    startWorkout: vi.fn().mockResolvedValue(undefined),
    stopWorkout: vi.fn().mockResolvedValue(undefined),
    startTimer: vi.fn().mockResolvedValue(undefined),
    stopTimer: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('@/lib/notifications', () => ({
  scheduleRestEndNotification: vi.fn().mockResolvedValue(undefined),
  cancelRestNotification: vi.fn().mockResolvedValue(undefined),
}))

describe('timerStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-19T12:00:00-03:00'))
    useTimerStore.setState({
      workoutSeconds: 0, workoutRunning: false, workoutStartedAt: null,
      restSeconds: 0, restTotal: 0, restRunning: false, restEndAt: null,
    })
  })

  it('retoma o cronometro usando o horario persistido', () => {
    const startedAt = Date.now() - 65_000
    useTimerStore.getState().startWorkoutTimer(startedAt)
    expect(useTimerStore.getState().workoutSeconds).toBe(65)
    vi.advanceTimersByTime(5_000)
    useTimerStore.getState().tickWorkout()
    expect(useTimerStore.getState().workoutSeconds).toBe(70)
  })

  it('recalcula o descanso pela hora final', () => {
    useTimerStore.getState().startWorkoutTimer(Date.now())
    useTimerStore.getState().startRest(60)
    vi.advanceTimersByTime(30_000)
    useTimerStore.getState().tickRest()
    expect(useTimerStore.getState().restSeconds).toBe(30)
    vi.advanceTimersByTime(31_000)
    useTimerStore.getState().tickRest()
    expect(useTimerStore.getState().restRunning).toBe(false)
  })

  it('estende o descanso sem reiniciar a contagem', () => {
    useTimerStore.getState().startWorkoutTimer(Date.now())
    useTimerStore.getState().startRest(60)
    vi.advanceTimersByTime(20_000)
    useTimerStore.getState().extendRest(15)
    expect(useTimerStore.getState().restSeconds).toBe(55)
    expect(useTimerStore.getState().restTotal).toBe(75)
    vi.advanceTimersByTime(54_000)
    useTimerStore.getState().tickRest()
    expect(useTimerStore.getState().restRunning).toBe(true)
  })
})
