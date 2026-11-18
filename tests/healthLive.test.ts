import { beforeEach, describe, expect, it, vi } from 'vitest'

const readSamples = vi.fn()
vi.mock('@capgo/capacitor-health', () => ({ Health: { readSamples } }))

const checkHealthChanges = vi.fn()
vi.mock('@/lib/healthChanges', () => ({ checkHealthChanges }))

import { readHeartToday } from '@/lib/health'
import { useHealthStore } from '@/stores/useHealthStore'
import { useProfileStore } from '@/stores/useProfileStore'

function hr(time: string, bpm: number) {
  return { startDate: new Date(time).toISOString(), endDate: new Date(time).toISOString(), value: bpm }
}

describe('readHeartToday', () => {
  beforeEach(() => readSamples.mockReset())

  it('reads the whole day and buckets it in 5 minutes', async () => {
    readSamples.mockResolvedValue({ samples: [hr('2026-11-13T08:01:00', 60), hr('2026-11-13T08:03:00', 70), hr('2026-11-13T08:06:00', 90)] })
    const today = await readHeartToday(new Date('2026-11-13T09:00:00'))
    expect(new Date(readSamples.mock.calls[0][0].startDate).getHours()).toBe(0)
    expect(today.points.map((point) => [point.avg, point.count])).toEqual([[65, 2], [90, 1]])
    expect(today).toMatchObject({ min: 60, max: 90, avg: 73, latest: { bpm: 90 } })
  })

  it('re-reads only from the last bucket when it has a previous reading', async () => {
    readSamples.mockResolvedValue({ samples: [hr('2026-11-13T08:01:00', 60), hr('2026-11-13T08:06:00', 90)] })
    const previous = await readHeartToday(new Date('2026-11-13T08:07:00'))

    // Health Connect returns whole records, so a sample before the range can come back.
    readSamples.mockResolvedValue({ samples: [hr('2026-11-13T08:04:00', 999), hr('2026-11-13T08:06:00', 90), hr('2026-11-13T08:11:00', 120)] })
    const next = await readHeartToday(new Date('2026-11-13T08:12:00'), previous)

    expect(new Date(readSamples.mock.calls[1][0].startDate).toISOString()).toBe(new Date('2026-11-13T08:05:00').toISOString())
    expect(next.points.map((point) => point.avg)).toEqual([60, 90, 120])
    expect(next).toMatchObject({ min: 60, max: 120, avg: 90, latest: { bpm: 120 } })
  })

  it('reads the whole day again after midnight', async () => {
    readSamples.mockResolvedValue({ samples: [hr('2026-11-13T23:58:00', 60)] })
    const yesterday = await readHeartToday(new Date('2026-11-13T23:59:00'))
    readSamples.mockResolvedValue({ samples: [hr('2026-11-14T00:02:00', 55)] })
    await readHeartToday(new Date('2026-11-14T00:03:00'), yesterday)
    expect(new Date(readSamples.mock.calls[1][0].startDate).getHours()).toBe(0)
    expect(new Date(readSamples.mock.calls[1][0].startDate).getDate()).toBe(14)
  })
})

describe('checkChanges', () => {
  const refresh = vi.fn()
  const refreshLive = vi.fn()

  beforeEach(() => {
    checkHealthChanges.mockReset()
    refresh.mockReset().mockResolvedValue(null)
    refreshLive.mockReset().mockResolvedValue(undefined)
    useProfileStore.setState({ profile: { preferences: { healthSync: true } } } as never)
    useHealthStore.setState({ refresh, refreshLive, lastRefreshed: Date.now(), lastLive: Date.now() })
  })

  it('does nothing when nothing changed', async () => {
    checkHealthChanges.mockResolvedValue({ available: true, reset: false, changed: [] })
    await useHealthStore.getState().checkChanges()
    expect(refresh).not.toHaveBeenCalled()
    expect(refreshLive).not.toHaveBeenCalled()
  })

  it('reads only heart rate when only heart rate changed', async () => {
    checkHealthChanges.mockResolvedValue({ available: true, reset: false, changed: ['heartRate'] })
    await useHealthStore.getState().checkChanges()
    expect(refreshLive).toHaveBeenCalledWith({ heart: true, steps: false })
    expect(refresh).not.toHaveBeenCalled()
  })

  it.each([
    ['a reset token', { reset: true, changed: [] }],
    ['a new sleep night', { reset: false, changed: ['sleep', 'heartRate'] }],
    ['a deletion', { reset: false, changed: ['deleted'] }],
  ])('re-reads everything after %s', async (_, change) => {
    checkHealthChanges.mockResolvedValue({ available: true, ...change })
    await useHealthStore.getState().checkChanges()
    expect(refresh).toHaveBeenCalledWith({ force: true })
    expect(refreshLive).not.toHaveBeenCalled()
  })

  it('falls back to throttled polling without the Changes API', async () => {
    checkHealthChanges.mockResolvedValue(null)
    useHealthStore.setState({ lastLive: Date.now() - 61_000 })
    await useHealthStore.getState().checkChanges()
    expect(refresh).toHaveBeenCalledWith()
    expect(refreshLive).toHaveBeenCalledTimes(1)
  })
})
