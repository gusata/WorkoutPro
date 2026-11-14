import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyWearAction, buildWearState, createActionDeduper, createStatePusher, parseNativeAction,
  pickTodaysWorkout, startWearBridge, type WearBridgeDeps,
} from '@/lib/wearBridge'
import type { NativeWearAction, WearBridgePluginInterface } from '@/lib/wearPlugin'
import type { ActiveSession, Exercise, Workout, WorkoutSession } from '@/types'
import { createStoreDeps } from '@/components/layout/WearSync'
import { useSessionStore } from '@/stores/useSessionStore'
import { useTimerStore } from '@/stores/useTimerStore'

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

const NOW = new Date('2026-08-19T12:00:00-03:00').getTime()

function session(): ActiveSession {
  return {
    sessionId: 'session-1', workoutId: 'workout-1', workoutName: 'Treino A', workoutColor: '#00c896',
    startedAt: new Date(NOW - 600_000), notes: '',
    exercises: [
      {
        exerciseId: 'bench', exerciseName: 'Supino', muscleGroup: 'Peitoral', restSeconds: 120,
        targetMinReps: 6, targetMaxReps: 10,
        progression: { type: 'double-progression', increment: 5, minimumRir: 1 },
        previousSets: [{ weight: 80, reps: 8, rpe: null }, { weight: 80, reps: 7, rpe: null }],
        sets: [
          { id: 'b1', weight: 80, reps: 8, rpe: null, completed: true, completedAt: new Date(NOW - 300_000) },
          { id: 'b2', weight: 82.5, reps: 8, rpe: null, completed: false, completedAt: null },
        ],
      },
      {
        exerciseId: 'row', exerciseName: 'Remada', muscleGroup: 'Costas', restSeconds: 90,
        sets: [{ id: 'r1', weight: 60, reps: 10, rpe: null, completed: false, completedAt: null }],
      },
    ],
  }
}

const idle = { restRunning: false, restEndAt: null, restTotal: 0 }

describe('buildWearState', () => {
  it('descreve a serie pendente, o anterior e a proxima', () => {
    const state = buildWearState(session(), idle)
    expect(state).toMatchObject({
      active: true, sessionId: 'session-1', workoutName: 'Treino A', exerciseId: 'bench', exerciseName: 'Supino',
      setId: 'b2', setIndex: 1, setCount: 2, targetWeight: 82.5, targetReps: 8, previousWeight: 80, previousReps: 7,
      weightStep: 5, restSeconds: 120, restEndAt: null, doneSets: 1, totalSets: 3, allDone: false,
      next: { exerciseName: 'Remada', setIndex: 0, setCount: 1, weight: 60, reps: 10 },
    })
  })

  it('usa 2,5 kg sem regra de progressao e envia o fim do descanso', () => {
    const active = session()
    active.exercises[0].sets[1].completed = true
    const state = buildWearState(active, { restRunning: true, restEndAt: NOW + 60_000, restTotal: 90 })
    expect(state.exerciseName).toBe('Remada')
    expect(state.weightStep).toBe(2.5)
    expect(state.previousWeight).toBeNull()
    expect(state.restEndAt).toBe(NOW + 60_000)
    expect(state.restTotal).toBe(90)
    expect(state.next).toBeNull()
  })

  it('marca tudo feito e fica inativo sem sessao', () => {
    const active = session()
    active.exercises.forEach((exercise) => exercise.sets.forEach((set) => { set.completed = true }))
    expect(buildWearState(active, idle)).toMatchObject({ active: true, allDone: true, setId: null, doneSets: 3 })
    expect(buildWearState(null, idle)).toMatchObject({ active: false, sessionId: null })
  })
})

describe('createStatePusher', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('agrupa mudancas e ignora estados repetidos', () => {
    const push = vi.fn()
    const pusher = createStatePusher(push, 300)
    const state = buildWearState(session(), idle)
    pusher.schedule(state)
    pusher.schedule({ ...state, targetReps: 9 })
    vi.advanceTimersByTime(299)
    expect(push).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(push).toHaveBeenCalledTimes(1)
    expect(JSON.parse(push.mock.calls[0][0]).targetReps).toBe(9)

    pusher.schedule({ ...state, targetReps: 9 })
    vi.advanceTimersByTime(300)
    expect(push).toHaveBeenCalledTimes(1)

    pusher.invalidate()
    pusher.schedule({ ...state, targetReps: 9 })
    vi.advanceTimersByTime(300)
    expect(push).toHaveBeenCalledTimes(2)
  })

  it('reenvia depois de uma falha nativa', async () => {
    const push = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined)
    const pusher = createStatePusher(push, 10)
    const state = buildWearState(null, idle)
    pusher.schedule(state)
    vi.advanceTimersByTime(10)
    await vi.waitFor(() => expect(push).toHaveBeenCalledTimes(1))
    await Promise.resolve()
    pusher.schedule(state)
    vi.advanceTimersByTime(10)
    expect(push).toHaveBeenCalledTimes(2)
  })
})

describe('parseNativeAction', () => {
  const raw = (type: string, payload: unknown): NativeWearAction => ({ type, payload: JSON.stringify(payload), receivedAt: NOW })

  it('valida e normaliza as mensagens do relogio', () => {
    expect(parseNativeAction(raw('set-done', { id: 'a', sessionId: 's', exerciseId: 'e', setId: 'x', weight: '82.5', reps: 8.4 })))
      .toEqual({ type: 'set-done', id: 'a', sessionId: 's', exerciseId: 'e', setId: 'x', weight: 82.5, reps: 8, receivedAt: NOW })
    expect(parseNativeAction(raw('rest', { op: 'extend', seconds: 15 }))).toMatchObject({ type: 'rest', op: 'extend', seconds: 15 })
    expect(parseNativeAction(raw('rest', { op: 'skip' }))).toMatchObject({ type: 'rest', op: 'skip' })
    expect(parseNativeAction({ type: 'start', payload: '', receivedAt: NOW })).toMatchObject({ type: 'start' })
    expect(parseNativeAction(raw('finish', { sessionId: 's' }))).toMatchObject({ type: 'finish', sessionId: 's' })
  })

  it('descarta mensagens invalidas', () => {
    expect(parseNativeAction(raw('set-done', { weight: 'x', reps: 8 }))).toBeNull()
    expect(parseNativeAction(raw('set-done', { weight: -5, reps: 8 }))).toBeNull()
    expect(parseNativeAction(raw('rest', { op: 'pause' }))).toBeNull()
    expect(parseNativeAction(raw('delete-everything', {}))).toBeNull()
    expect(parseNativeAction({ type: 'finish', payload: '{oops', receivedAt: NOW })).toBeNull()
  })
})

describe('applyWearAction com as stores reais', () => {
  let deps: WearBridgeDeps

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    useSessionStore.setState({ active: session() })
    useTimerStore.setState({ workoutRunning: true, workoutStartedAt: NOW - 600_000, restRunning: false, restEndAt: null, restSeconds: 0, restTotal: 0 })
    deps = createStoreDeps(vi.fn())
  })
  afterEach(() => vi.useRealTimers())

  it('conclui a serie com a carga do relogio e inicia o descanso do exercicio', async () => {
    const result = await applyWearAction({ type: 'set-done', sessionId: 'session-1', exerciseId: 'bench', setId: 'b2', weight: 85, reps: 6, receivedAt: NOW }, deps, NOW)
    expect(result).toBe('applied')
    const set = useSessionStore.getState().active!.exercises[0].sets[1]
    expect(set).toMatchObject({ weight: 85, reps: 6, completed: true })
    expect(useTimerStore.getState()).toMatchObject({ restRunning: true, restEndAt: NOW + 120_000 })
  })

  it('usa a serie pendente atual quando a do relogio ja foi feita no celular', async () => {
    useSessionStore.getState().completeSet('bench', 'b2')
    await applyWearAction({ type: 'set-done', exerciseId: 'bench', setId: 'b2', weight: 62.5, reps: 9, receivedAt: NOW }, deps, NOW)
    const row = useSessionStore.getState().active!.exercises[1].sets[0]
    expect(row).toMatchObject({ weight: 62.5, reps: 9, completed: true })
    // The set already done on the phone stays done (completeSet toggles, so this matters).
    expect(useSessionStore.getState().active!.exercises[0].sets[1].completed).toBe(true)
  })

  it('ignora acoes de outra sessao ou antigas demais', async () => {
    expect(await applyWearAction({ type: 'set-done', sessionId: 'old', weight: 1, reps: 1, receivedAt: NOW }, deps, NOW)).toBe('ignored')
    expect(await applyWearAction({ type: 'set-done', weight: 1, reps: 1, receivedAt: NOW - 7 * 3_600_000 }, deps, NOW)).toBe('ignored')
    expect(useSessionStore.getState().active!.exercises[0].sets[1].completed).toBe(false)
  })

  it('estende e pula o descanso', async () => {
    useTimerStore.getState().startRest(60)
    await applyWearAction({ type: 'rest', op: 'extend', seconds: 15, receivedAt: NOW }, deps, NOW)
    expect(useTimerStore.getState().restEndAt).toBe(NOW + 75_000)
    await applyWearAction({ type: 'rest', op: 'skip', seconds: 15, receivedAt: NOW }, deps, NOW)
    expect(useTimerStore.getState().restRunning).toBe(false)
    expect(await applyWearAction({ type: 'rest', op: 'skip', seconds: 15, receivedAt: NOW }, deps, NOW)).toBe('ignored')
  })

  it('so inicia treino quando nao ha sessao e o pedido e recente', async () => {
    const start = vi.fn().mockResolvedValue(true)
    const custom = { ...deps, startTodaysWorkout: start }
    expect(await applyWearAction({ type: 'start', receivedAt: NOW }, custom, NOW)).toBe('ignored')
    useSessionStore.setState({ active: null })
    expect(await applyWearAction({ type: 'start', receivedAt: NOW - 11 * 60_000 }, custom, NOW)).toBe('ignored')
    expect(await applyWearAction({ type: 'start', receivedAt: NOW }, custom, NOW)).toBe('applied')
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('finaliza pela acao da store', async () => {
    const finish = vi.fn().mockResolvedValue(undefined)
    expect(await applyWearAction({ type: 'finish', sessionId: 'session-1', receivedAt: NOW }, { ...deps, finishSession: finish }, NOW)).toBe('applied')
    expect(finish).toHaveBeenCalledTimes(1)
  })
})

describe('pickTodaysWorkout', () => {
  const exercise = (id: string) => ({ id, name: id, muscleGroup: 'Peitoral' }) as Exercise
  const workout = (id: string, weekdays?: number[]) => ({ id, name: id, color: '#fff', exerciseIds: ['e1', 'missing'], scheduledWeekdays: weekdays }) as unknown as Workout
  const done = (workoutId: string, finishedAt: Date) => ({ id: `${workoutId}-${finishedAt.getTime()}`, workoutId, finishedAt, startedAt: finishedAt }) as unknown as WorkoutSession
  const now = new Date(NOW) // Wednesday

  it('prefere o agendado para hoje e cai no mais antigo', () => {
    const workouts = [workout('A'), workout('B', [3]), workout('C')]
    expect(pickTodaysWorkout(workouts, [exercise('e1')], [], now)?.workout.id).toBe('B')
    expect(pickTodaysWorkout(workouts, [exercise('e1')], [], now)?.exercises.map((item) => item.id)).toEqual(['e1'])
    const sessions = [done('B', new Date(NOW - 3_600_000)), done('A', new Date(NOW - 86_400_000)), done('C', new Date(NOW - 5 * 86_400_000))]
    expect(pickTodaysWorkout(workouts, [], sessions, now)?.workout.id).toBe('C')
    expect(pickTodaysWorkout([], [], [], now)).toBeNull()
  })
})

describe('startWearBridge', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('drena a fila pendente, aplica uma vez e publica o estado', async () => {
    const actions: NativeWearAction[] = [
      { type: 'set-done', payload: JSON.stringify({ id: 'm1', weight: 82.5, reps: 8 }), receivedAt: Date.now() },
      { type: 'set-done', payload: JSON.stringify({ id: 'm1', weight: 82.5, reps: 8 }), receivedAt: Date.now() },
    ]
    let listener: (() => void) | undefined
    const plugin = {
      pushState: vi.fn().mockResolvedValue(undefined),
      drainActions: vi.fn().mockResolvedValueOnce({ actions }).mockResolvedValue({ actions: [] }),
      addListener: vi.fn(async (_event: string, fn: () => void) => { listener = fn; return { remove: vi.fn() } }),
    } as unknown as WearBridgePluginInterface
    let active: ActiveSession | null = session()
    const completeSet = vi.fn((exerciseId: string, setId: string) => {
      active = { ...active!, exercises: active!.exercises.map((e) => e.exerciseId !== exerciseId ? e : { ...e, sets: e.sets.map((s) => s.id === setId ? { ...s, completed: true } : s) }) }
    })
    const deps: WearBridgeDeps = {
      getActive: () => active, getTimer: () => idle, updateSet: vi.fn(), completeSet, startRest: vi.fn(),
      extendRest: vi.fn(), stopRest: vi.fn(), startTodaysWorkout: vi.fn(), finishSession: vi.fn(),
    }
    const bridge = startWearBridge({ plugin, deps, subscribe: () => () => undefined, debounceMs: 50 })
    await bridge.drain()
    expect(completeSet).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(50)
    expect(plugin.pushState).toHaveBeenCalledTimes(1)
    expect(JSON.parse(vi.mocked(plugin.pushState).mock.calls[0][0].json)).toMatchObject({ exerciseName: 'Remada', doneSets: 2 })

    await vi.waitFor(() => expect(listener).toBeDefined())
    const before = vi.mocked(plugin.drainActions).mock.calls.length
    listener!()
    await bridge.drain()
    expect(vi.mocked(plugin.drainActions).mock.calls.length).toBeGreaterThan(before)
    expect(completeSet).toHaveBeenCalledTimes(1)
    bridge.stop()
  })

  it('deduplica ids repetidos', () => {
    const isNew = createActionDeduper(2)
    expect(isNew('a')).toBe(true)
    expect(isNew('a')).toBe(false)
    expect(isNew(undefined)).toBe(true)
    isNew('b'); isNew('c')
    expect(isNew('a')).toBe(true)
  })
})
