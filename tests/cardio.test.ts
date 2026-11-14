import { beforeEach, describe, expect, it } from 'vitest'
import {
  activityFromHealthType, cardioMinutesInWeek, formatDistance, formatPace, isDuplicateCardio, maxHeartRate, timeInZones, zoneFor,
} from '@/lib/cardio'
import { computeReadiness } from '@/lib/readiness'
import { clearLocalData, db, initProfile } from '@/lib/db'
import { exportData, importData, parseBackup } from '@/lib/backup'
import { useCardioStore } from '@/stores/useCardioStore'
import type { CardioSession } from '@/types'

function cardio(overrides: Partial<CardioSession> = {}): CardioSession {
  return {
    id: 'c1', activity: 'running', startedAt: new Date('2026-11-10T07:00:00'), duration: 1800, distance: 5000,
    calories: 320, avgHeartRate: 150, maxHeartRate: 172, zones: null, effort: null, source: 'manual',
    externalId: null, sourceName: null, notes: '', updatedAt: new Date('2026-11-10T08:00:00'), ...overrides,
  }
}

function daily(values: number[], end = new Date('2026-11-13T08:00:00')) {
  return values.map((value, index) => ({ date: new Date(end.getTime() - (values.length - 1 - index) * 86_400_000), value }))
}

describe('cardio helpers', () => {
  it('maps health workout types and skips strength work', () => {
    expect(activityFromHealthType('running')).toBe('running')
    expect(activityFromHealthType('runningTreadmill')).toBe('treadmill')
    expect(activityFromHealthType('bikingStationary')).toBe('cycling')
    expect(activityFromHealthType('highIntensityIntervalTraining')).toBe('hiit')
    expect(activityFromHealthType('weightlifting')).toBeNull()
    expect(activityFromHealthType('strengthTraining')).toBeNull()
  })

  it('estimates max heart rate and zones', () => {
    expect(maxHeartRate({ birthYear: 1996 }, new Date('2026-06-01'))).toBe(187)
    expect(maxHeartRate({ birthYear: 1996, maxHeartRate: 195 })).toBe(195)
    expect(maxHeartRate({})).toBeNull()
    expect(zoneFor(95, 190)).toBe(0)
    expect(zoneFor(140, 190)).toBe(2)
    expect(zoneFor(185, 190)).toBe(4)
    expect(zoneFor(80, 190)).toBe(-1)
  })

  it('accumulates time in zones with gaps capped at 60s', () => {
    const start = new Date('2026-11-10T07:00:00')
    const at = (seconds: number, bpm: number) => ({ time: new Date(start.getTime() + seconds * 1000), bpm })
    const zones = timeInZones([at(0, 120), at(30, 160), at(600, 160)], 200, new Date(start.getTime() + 610_000))
    // 120 bpm = 60% → Z2 for 30 s; 160 = 80% → Z4 for 60 s (capped) + 10 s.
    expect(zones).toEqual([0, 30, 0, 70, 0])
  })

  it('formats distance and pace', () => {
    expect(formatDistance(5230)).toBe('5,23 km')
    expect(formatDistance(800)).toBe('800 m')
    expect(formatPace(1800, 5000)).toBe('6:00 /km')
    expect(formatPace(600, 50)).toBeNull()
  })

  it('sums this week and detects duplicates', () => {
    const now = new Date('2026-11-13T12:00:00')
    expect(cardioMinutesInWeek([cardio(), cardio({ id: 'old', startedAt: new Date('2026-11-01T07:00:00') })], now)).toBe(30)
    expect(isDuplicateCardio([cardio({ externalId: 'hc-1' })], { externalId: 'hc-1', startedAt: new Date(), activity: 'walking' })).toBe(true)
    expect(isDuplicateCardio([cardio()], { externalId: null, startedAt: new Date('2026-11-10T07:01:00'), activity: 'running' })).toBe(true)
    expect(isDuplicateCardio([cardio()], { externalId: null, startedAt: new Date('2026-11-10T09:00:00'), activity: 'running' })).toBe(false)
  })
})

describe('readiness', () => {
  const now = new Date('2026-11-13T09:00:00')

  it('is high after a good night with HRV above baseline', () => {
    const result = computeReadiness({
      hrv: daily([50, 52, 48, 51, 49, 50, 62], now),
      restingHr: daily([55, 56, 54, 55, 56, 55, 52], now),
      sleep: { asleep: 480, deep: 90, rem: 110, hasStages: true, end: new Date('2026-11-13T07:00:00') },
      recentSets: 0,
      now,
    })
    expect(result?.level).toBe('high')
    expect(result?.components.map((item) => item.key)).toEqual(['hrv', 'rhr', 'sleep', 'load'])
  })

  it('is low after poor sleep, suppressed HRV and elevated resting HR', () => {
    const result = computeReadiness({
      hrv: daily([50, 52, 48, 51, 49, 50, 38], now),
      restingHr: daily([55, 56, 54, 55, 56, 55, 63], now),
      sleep: { asleep: 300, deep: 20, rem: 30, hasStages: true, end: new Date('2026-11-13T06:00:00') },
      recentSets: 30,
      now,
    })
    expect(result?.level).toBe('low')
  })

  it('returns null without data and ignores stale readings', () => {
    expect(computeReadiness({ hrv: [], restingHr: [], sleep: null, recentSets: 10, now })).toBeNull()
    expect(computeReadiness({ hrv: daily([50, 50, 50, 50], new Date('2026-11-05T08:00:00')), restingHr: [], sleep: null, recentSets: 0, now })).toBeNull()
  })
})

describe('cardio storage', () => {
  beforeEach(async () => {
    await clearLocalData()
    await initProfile()
    await useCardioStore.getState().load()
  })

  it('adds manual sessions, queues sync and round-trips through backups', async () => {
    const { id: _id, updatedAt: _updatedAt, ...data } = cardio()
    void _id; void _updatedAt
    const saved = await useCardioStore.getState().add(data)
    expect(await db.cardio.count()).toBe(1)
    expect(await db.syncQueue.where('[entity+entityId]').equals(['cardio', saved.id]).count()).toBe(1)

    const backup = JSON.parse(JSON.stringify(await exportData()))
    await clearLocalData()
    await importData(parseBackup(backup))
    const restored = await db.cardio.get(saved.id)
    expect(restored?.distance).toBe(5000)
    expect(restored?.startedAt).toBeInstanceOf(Date)
  })

  it('imports only new cardio workouts from the health store', async () => {
    const workout = {
      externalId: 'hc-1', type: 'running', startedAt: new Date('2026-11-12T07:00:00'), endedAt: new Date('2026-11-12T07:30:00'),
      duration: 1800, distance: 5100, calories: 330, sourceName: 'Samsung Health',
    }
    const strength = { ...workout, externalId: 'hc-2', type: 'strengthTraining' }
    expect(await useCardioStore.getState().importFromHealth([workout, strength], null)).toBe(1)
    expect(await useCardioStore.getState().importFromHealth([workout], null)).toBe(0)
    const [stored] = useCardioStore.getState().sessions
    expect(stored).toMatchObject({ activity: 'running', source: 'health', distance: 5100, sourceName: 'Samsung Health' })
  })

  it('does not re-import a workout the user deleted', async () => {
    const workout = {
      externalId: 'hc-9', type: 'walking', startedAt: new Date('2026-11-12T18:00:00'), endedAt: new Date('2026-11-12T18:40:00'),
      duration: 2400, distance: 3000, calories: 150, sourceName: null,
    }
    await useCardioStore.getState().importFromHealth([workout], null)
    await useCardioStore.getState().remove(useCardioStore.getState().sessions[0].id)
    expect(await useCardioStore.getState().importFromHealth([workout], null)).toBe(0)
  })
})
