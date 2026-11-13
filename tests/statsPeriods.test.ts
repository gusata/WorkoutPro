import { describe, expect, it } from 'vitest'
import { getMonthWeekBuckets, getStatsInterval, getWeeklyBuckets } from '@/lib/statsPeriods'

describe('statsPeriods', () => {
  it('usa semana de segunda a domingo', () => {
    const interval = getStatsInterval('week', new Date('2026-08-19T12:00:00'))
    expect(interval.start.getDay()).toBe(1)
    expect(interval.end.getDay()).toBe(0)
    expect(interval.start.getDate()).toBe(17)
    expect(interval.end.getDate()).toBe(23)
  })

  it('gera semanas completas em ordem cronologica', () => {
    const buckets = getWeeklyBuckets(3, new Date('2026-08-19T12:00:00'))
    expect(buckets).toHaveLength(3)
    expect(buckets.map((bucket) => bucket.start.getDate())).toEqual([3, 10, 17])
  })

  it('recorta as semanas do grafico nos limites do mes', () => {
    const buckets = getMonthWeekBuckets(new Date('2026-08-19T12:00:00'))
    expect(buckets[0].start.getDate()).toBe(1)
    expect(buckets.at(-1)?.end.getDate()).toBe(31)
    expect(buckets.every((bucket) => bucket.start.getMonth() === 7 && bucket.end.getMonth() === 7)).toBe(true)
  })
})
