import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildWidgetPayload, createChangePusher, lastWorkoutShortcut } from '@/lib/widgetSync'
import { buildLiveStatus, MAX_PENDING_STEPS } from '@/lib/liveStatus'
import { makeProfile, makeSession, makeWorkout } from './fixtures'
import type { ActiveSession } from '@/types'

describe('widget payload', () => {
  it('monta a agenda por dia da semana, sequencia e ultima frequencia cardiaca', () => {
    const payload = buildWidgetPayload({
      workouts: [
        makeWorkout({ id: 'a', name: 'Treino A', scheduledWeekdays: [1, 3] }),
        makeWorkout({ id: 'b', name: 'Treino B', scheduledWeekdays: [3] }),
        makeWorkout({ id: 'c', name: 'Livre' }),
      ],
      profile: makeProfile({ streak: 4, lastWorkoutDate: new Date(2026, 7, 18, 21, 30) }),
      heartToday: { latest: { bpm: 71.6, time: new Date(2026, 7, 19, 14, 32) }, points: [], min: 60, max: 120, avg: 80 },
    })
    expect(payload.schedule).toHaveLength(7)
    expect(payload.schedule[0]).toEqual([])
    expect(payload.schedule[1]).toEqual([{ id: 'a', name: 'Treino A' }])
    expect(payload.schedule[3].map((item) => item.name)).toEqual(['Treino A', 'Treino B'])
    expect(payload.streak).toBe(4)
    expect(payload.lastWorkoutDay).toBe('2026-08-18')
    expect(payload.heartRate).toEqual({ bpm: 72, time: new Date(2026, 7, 19, 14, 32).getTime() })
  })

  it('sem perfil ou leitura cardiaca usa valores vazios', () => {
    const payload = buildWidgetPayload({ workouts: [], profile: null, heartToday: null })
    expect(payload).toEqual({ schedule: [[], [], [], [], [], [], []], streak: 0, lastWorkoutDay: null, heartRate: null })
  })

  it('o atalho dinamico aponta para o ultimo treino finalizado que ainda existe', () => {
    const workouts = [makeWorkout({ id: 'a', name: 'Treino A' }), makeWorkout({ id: 'b', name: 'Treino B' })]
    const sessions = [
      makeSession({ id: '1', workoutId: 'a', finishedAt: new Date('2026-08-10T10:00:00Z') }),
      makeSession({ id: '2', workoutId: 'b', finishedAt: new Date('2026-08-12T10:00:00Z') }),
      makeSession({ id: '3', workoutId: 'deleted', finishedAt: new Date('2026-08-15T10:00:00Z') }),
      makeSession({ id: '4', workoutId: 'a', finishedAt: null }),
    ]
    expect(lastWorkoutShortcut(sessions, workouts)).toEqual({ id: 'b', name: 'Treino B' })
    expect(lastWorkoutShortcut([], workouts)).toBeNull()
  })
})

describe('createChangePusher', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('agrupa mudancas rapidas e envia so o ultimo valor', async () => {
    const send = vi.fn()
    const pusher = createChangePusher<{ n: number }>(send, 1000)
    pusher.push({ n: 1 })
    pusher.push({ n: 2 })
    vi.advanceTimersByTime(999)
    expect(send).not.toHaveBeenCalled()
    pusher.push({ n: 3 })
    vi.advanceTimersByTime(1000)
    await Promise.resolve()
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith({ n: 3 })
  })

  it('nao reenvia um valor identico ao ultimo enviado', async () => {
    const send = vi.fn()
    const pusher = createChangePusher<{ n: number }>(send, 500)
    pusher.push({ n: 1 })
    vi.advanceTimersByTime(500)
    await Promise.resolve()
    pusher.push({ n: 1 })
    vi.advanceTimersByTime(500)
    // Changed and changed back before the debounce fired: nothing new to send.
    pusher.push({ n: 2 })
    pusher.push({ n: 1 })
    vi.advanceTimersByTime(500)
    await Promise.resolve()
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('flush envia na hora e uma falha permite tentar de novo', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('bridge')).mockResolvedValue(undefined)
    const pusher = createChangePusher<{ n: number }>(send, 5000)
    pusher.push({ n: 1 })
    pusher.flush()
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    await Promise.resolve()
    pusher.push({ n: 1 })
    pusher.flush()
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2))
  })
})

describe('buildLiveStatus', () => {
  function active(sets: number, done: number): ActiveSession {
    return {
      sessionId: 's', workoutId: 'w', workoutName: 'Treino A', workoutColor: '#000', startedAt: new Date(), notes: '',
      exercises: [{
        exerciseId: 'e1', exerciseName: 'Supino', muscleGroup: 'Peitoral', notes: '', restSeconds: 120,
        sets: Array.from({ length: sets }, (_, index) => ({
          id: `set-${index}`, weight: 80, reps: 8, rpe: null, completed: index < done, completedAt: null,
        })),
      }],
    }
  }

  it('lista as series pendentes em ordem com o descanso do exercicio', () => {
    const status = buildLiveStatus(active(3, 1))!
    expect(status.doneSets).toBe(1)
    expect(status.totalSets).toBe(3)
    expect(status.pending!.map((step) => step.setId)).toEqual(['set-1', 'set-2'])
    expect(status.pending![0]).toMatchObject({ exerciseId: 'e1', restSeconds: 120 })
    expect(status.current).toBe(status.pending![0].label)
    expect(status.current).toContain('série 2 de 3')
  })

  it('limita a lista e indica quando tudo foi feito', () => {
    expect(buildLiveStatus(active(MAX_PENDING_STEPS + 5, 0))!.pending).toHaveLength(MAX_PENDING_STEPS)
    const done = buildLiveStatus(active(2, 2))!
    expect(done.pending).toEqual([])
    expect(done.current).toBe('Tudo feito. Finalize o treino.')
    expect(buildLiveStatus(null)).toBeNull()
  })
})
