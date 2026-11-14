import { beforeEach, describe, expect, it, vi } from 'vitest'

const heartRateSamples = vi.fn()
vi.mock('@/lib/health', async (importOriginal) => ({ ...(await importOriginal<object>()), heartRateSamples }))

import { clearLocalData, initProfile } from '@/lib/db'
import {
  estimateStrengthCalories, formatSampleAge, freshSample, isRecovered, liveZones, mergeSamples, recoveryThreshold,
} from '@/lib/liveHeart'
import { useCardioStore } from '@/stores/useCardioStore'
import { useLiveCardioStore } from '@/stores/useLiveCardioStore'
import { useProfileStore } from '@/stores/useProfileStore'

const NOW = new Date('2026-11-13T18:30:00').getTime()
const at = (secondsAgo: number, bpm: number) => ({ time: new Date(NOW - secondsAgo * 1000), bpm })

describe('live heart rate helpers', () => {
  it('only treats readings from the last 3 minutes as live', () => {
    expect(freshSample(at(20, 120), NOW)?.bpm).toBe(120)
    expect(freshSample(at(179, 120), NOW)).not.toBeNull()
    expect(freshSample(at(181, 120), NOW)).toBeNull()
    expect(freshSample(null, NOW)).toBeNull()
  })

  it('formats the age of a reading', () => {
    expect(formatSampleAge(new Date(NOW - 3000), NOW)).toBe('agora')
    expect(formatSampleAge(new Date(NOW - 20_000), NOW)).toBe('há 20 s')
    expect(formatSampleAge(new Date(NOW - 150_000), NOW)).toBe('há 2 min')
  })

  it('derives the recovery threshold from resting and max HR', () => {
    expect(recoveryThreshold({ maxHr: 190, restingHr: 60 })).toBe(112)
    expect(recoveryThreshold({ maxHr: 190, restingHr: null })).toBe(114)
    expect(recoveryThreshold({ maxHr: null, restingHr: 60 })).toBeNull()
    expect(recoveryThreshold({ custom: 105, maxHr: 190, restingHr: 60 })).toBe(105)
  })

  it('needs a fresh reading taken during the rest, under the threshold', () => {
    const restStart = NOW - 60_000
    expect(isRecovered(at(10, 110), restStart, 112, NOW)).toBe(true)
    expect(isRecovered(at(10, 130), restStart, 112, NOW)).toBe(false)
    // Taken before the rest started (still from the set).
    expect(isRecovered(at(90, 100), restStart, 112, NOW)).toBe(false)
    expect(isRecovered(at(10, 100), null, 112, NOW)).toBe(false)
    expect(isRecovered(at(10, 100), restStart, null, NOW)).toBe(false)
  })

  it('estimates active calories only with a body weight', () => {
    expect(estimateStrengthCalories(3600, 80)).toBe(320)
    expect(estimateStrengthCalories(3600, null)).toBeNull()
    expect(estimateStrengthCalories(30, 80)).toBeNull()
  })

  it('computes the current zone and time per zone since the start', () => {
    const start = NOW - 120_000
    const samples = [at(200, 180), at(120, 95), at(90, 125), at(60, 145), at(30, 165), at(10, 175)]
    const stats = liveZones(samples, start, 200, NOW)
    expect(stats.bpm).toBe(175)
    expect(stats.zone).toBe(3)
    // Before the start is ignored; 95 bpm is under zone 1 (50%); 125→Z2 30 s, 145→Z3 30 s,
    // 165→Z4 20 s, 175→Z4 10 s until now.
    expect(stats.zones).toEqual([0, 30, 30, 30, 0])
    expect(stats.max).toBe(175)
  })

  it('merges samples without duplicates', () => {
    const merged = mergeSamples([at(30, 100), at(20, 110)], [at(20, 110), at(10, 120)])
    expect(merged.map((sample) => sample.bpm)).toEqual([100, 110, 120])
  })
})

describe('live cardio session', () => {
  beforeEach(async () => {
    heartRateSamples.mockReset()
    await clearLocalData()
    await initProfile()
    await useCardioStore.getState().load()
    useLiveCardioStore.setState({ live: null })
    useProfileStore.setState({ profile: { preferences: { healthSync: true, maxHeartRate: 200 } } } as never)
  })

  it('pulls only new samples and saves zones from Health Connect on stop', async () => {
    const startedAt = Date.now() - 10 * 60_000
    useLiveCardioStore.setState({ live: { activity: 'running', startedAt, samples: [] } })

    const s = (minutes: number, bpm: number) => ({ time: new Date(startedAt + minutes * 60_000), bpm })
    heartRateSamples.mockResolvedValueOnce([{ time: new Date(startedAt - 60_000), bpm: 70 }, s(1, 130)])
    await useLiveCardioStore.getState().pull()
    expect(useLiveCardioStore.getState().live?.samples).toEqual([[startedAt + 60_000, 130]])

    heartRateSamples.mockResolvedValueOnce([s(1, 130), s(2, 150)])
    await useLiveCardioStore.getState().pull()
    expect(new Date(heartRateSamples.mock.calls[1][0]).getTime()).toBe(startedAt + 60_000)
    expect(useLiveCardioStore.getState().live?.samples).toHaveLength(2)

    // On stop the whole interval is read again (late samples from the watch).
    heartRateSamples.mockResolvedValueOnce([s(1, 130), s(1.5, 140), s(2, 150), s(3, 185)])
    const saved = await useLiveCardioStore.getState().stop()
    expect(useLiveCardioStore.getState().live).toBeNull()
    expect(saved).toMatchObject({ activity: 'running', avgHeartRate: 151, maxHeartRate: 185, source: 'manual' })
    expect(saved!.duration).toBeGreaterThanOrEqual(599)
    // 130→Z2 30 s, 140→Z3 30 s, 150→Z3 60 s, 185→Z5 capped at 60 s.
    expect(saved!.zones).toEqual([0, 30, 90, 0, 60])
    expect(useCardioStore.getState().sessions).toHaveLength(1)
  })

  it('discards activities shorter than a minute', async () => {
    useLiveCardioStore.getState().start('cycling')
    expect(await useLiveCardioStore.getState().stop()).toBeNull()
    expect(useCardioStore.getState().sessions).toHaveLength(0)
  })
})
