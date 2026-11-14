import { beforeEach, describe, expect, it, vi } from 'vitest'

const writeExerciseSession = vi.fn()
vi.mock('@/lib/healthChanges', () => ({
  writeExerciseSession,
  checkHealthChanges: vi.fn().mockResolvedValue(null),
  healthWriteStatus: vi.fn().mockResolvedValue(null),
  requestHealthWritePermissions: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/timerPlugin', () => ({
  TimerPlugin: {
    startWorkout: vi.fn().mockResolvedValue(undefined), stopWorkout: vi.fn().mockResolvedValue(undefined),
    startTimer: vi.fn().mockResolvedValue(undefined), stopTimer: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('@/lib/notifications', () => ({ cancelRestNotification: vi.fn().mockResolvedValue(undefined) }))

import { clearLocalData, initProfile } from '@/lib/db'
import { isOwnHealthWorkout } from '@/lib/cardio'
import { OWN_HEALTH_SOURCE, writeStrengthSession } from '@/lib/health'
import { useCardioStore } from '@/stores/useCardioStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { healthSessionNotes, useSessionStore } from '@/stores/useSessionStore'

const runningWorkout = {
  externalId: 'hc-run', type: 'running', startedAt: new Date('2026-11-12T07:00:00'), endedAt: new Date('2026-11-12T07:30:00'),
  duration: 1800, distance: 5100, calories: 330, sourceName: 'Samsung Health', sourceId: 'com.sec.android.app.shealth',
}

describe('own Health Connect records are not re-imported', () => {
  beforeEach(async () => {
    await clearLocalData()
    await initProfile()
    await useCardioStore.getState().load()
  })

  it('recognizes the app package as data origin', () => {
    expect(OWN_HEALTH_SOURCE).toBe('com.workoutpro.app')
    expect(isOwnHealthWorkout({ sourceId: 'com.workoutpro.app' })).toBe(true)
    expect(isOwnHealthWorkout({ sourceId: 'com.sec.android.app.shealth' })).toBe(false)
    expect(isOwnHealthWorkout({ sourceId: null })).toBe(false)
    expect(isOwnHealthWorkout({})).toBe(false)
  })

  it('skips workouts written by this app, even with a cardio-like type', async () => {
    const own = { ...runningWorkout, externalId: 'hc-own', startedAt: new Date('2026-11-12T18:00:00'), endedAt: new Date('2026-11-12T19:00:00'), sourceId: 'com.workoutpro.app', type: 'other' }
    const ownAsCardio = { ...own, externalId: 'hc-own-2', type: 'running', startedAt: new Date('2026-11-11T18:00:00'), endedAt: new Date('2026-11-11T19:00:00') }
    expect(await useCardioStore.getState().importFromHealth([own, ownAsCardio, runningWorkout], null)).toBe(1)
    expect(useCardioStore.getState().sessions.map((item) => item.externalId)).toEqual(['hc-run'])
  })
})

describe('writing strength sessions', () => {
  beforeEach(async () => {
    writeExerciseSession.mockReset().mockResolvedValue({ written: true, calories: true })
    await clearLocalData()
    await initProfile()
  })

  it('uses the session id as a stable clientRecordId', async () => {
    const session = { id: 'abc', title: 'Treino A', startedAt: new Date('2026-11-13T18:00:00Z'), finishedAt: new Date('2026-11-13T19:00:00Z'), activeCalories: 300 }
    expect(await writeStrengthSession(session)).toBe(true)
    expect(await writeStrengthSession(session)).toBe(true)
    expect(writeExerciseSession).toHaveBeenCalledTimes(2)
    for (const [input] of writeExerciseSession.mock.calls) {
      expect(input).toMatchObject({
        clientRecordId: 'workoutpro-session-abc', title: 'Treino A', exerciseType: 'strength', activeCalories: 300,
        startTime: '2026-11-13T18:00:00.000Z', endTime: '2026-11-13T19:00:00.000Z',
      })
    }
  })

  it('skips sessions shorter than a minute and never throws', async () => {
    expect(await writeStrengthSession({ id: 'x', title: 'T', startedAt: new Date(0), finishedAt: new Date(30_000) })).toBe(false)
    writeExerciseSession.mockRejectedValue(new Error('boom'))
    expect(await writeStrengthSession({ id: 'y', title: 'T', startedAt: new Date(0), finishedAt: new Date(600_000) })).toBe(false)
  })

  it('describes completed sets in the notes', () => {
    const notes = healthSessionNotes({
      notes: ' Bom treino ',
      exercises: [
        { exerciseName: 'Supino', sets: [{ completed: true }, { completed: true }, { completed: false }] },
        { exerciseName: 'Remada', sets: [{ completed: false }] },
        { exerciseName: 'Rosca', sets: [{ completed: true }] },
      ],
    } as never, 2400)
    expect(notes).toBe('Supino: 2 séries\nRosca: 1 série\nVolume: 2400 kg\nBom treino')
  })

  it('mirrors the finished session when health sync is on', async () => {
    useProfileStore.setState({
      profile: { preferences: { healthSync: true } },
      measurements: [{ id: 'm1', date: new Date(), weight: 80 }],
    } as never)
    useSessionStore.setState({
      active: {
        sessionId: 'session-hc', workoutId: 'workout-1', workoutName: 'Superior A', workoutColor: '#00c896',
        startedAt: new Date(Date.now() - 45 * 60_000), notes: '',
        exercises: [{
          exerciseId: 'exercise-1', exerciseName: 'Supino', muscleGroup: 'Peitoral', notes: '', restSeconds: 90,
          sets: [{ id: 'set-1', weight: 100, reps: 10, rpe: null, completed: true, completedAt: new Date() }],
        }],
      },
    })
    await useSessionStore.getState().endSession()
    await vi.waitFor(() => expect(writeExerciseSession).toHaveBeenCalledTimes(1))
    const [input] = writeExerciseSession.mock.calls[0]
    expect(input).toMatchObject({ clientRecordId: 'workoutpro-session-session-hc', title: 'Superior A' })
    // (5 − 1) MET × 80 kg × 0.75 h
    expect(input.activeCalories).toBe(240)
    expect(input.notes).toContain('Supino: 1 série')
  })

  it('does not write when health sync is off', async () => {
    useProfileStore.setState({ profile: { preferences: { healthSync: false } }, measurements: [] } as never)
    useSessionStore.setState({
      active: {
        sessionId: 'session-off', workoutId: 'workout-1', workoutName: 'A', workoutColor: '#00c896',
        startedAt: new Date(Date.now() - 30 * 60_000), notes: '', exercises: [],
      },
    })
    await useSessionStore.getState().endSession()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(writeExerciseSession).not.toHaveBeenCalled()
  })
})
