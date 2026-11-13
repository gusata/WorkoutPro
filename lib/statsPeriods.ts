import {
  addWeeks, endOfMonth, endOfWeek, endOfYear, startOfMonth, startOfWeek, startOfYear, subWeeks,
} from 'date-fns'

export type StatsPeriod = 'week' | 'month' | 'year'

export function getStatsInterval(period: StatsPeriod, now: Date = new Date()) {
  if (period === 'week') {
    return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
  }
  if (period === 'month') return { start: startOfMonth(now), end: endOfMonth(now) }
  return { start: startOfYear(now), end: endOfYear(now) }
}

export function getWeeklyBuckets(count: number, now: Date = new Date()) {
  const currentStart = startOfWeek(now, { weekStartsOn: 1 })
  return Array.from({ length: count }, (_, index) => {
    const start = subWeeks(currentStart, count - 1 - index)
    return { start, end: endOfWeek(start, { weekStartsOn: 1 }) }
  })
}

export function getMonthWeekBuckets(now: Date = new Date()) {
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const firstWeekStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const buckets = []
  for (let cursor = firstWeekStart; cursor <= monthEnd; cursor = addWeeks(cursor, 1)) {
    const weekEnd = endOfWeek(cursor, { weekStartsOn: 1 })
    buckets.push({
      start: cursor < monthStart ? monthStart : cursor,
      end: weekEnd > monthEnd ? monthEnd : weekEnd,
    })
  }
  return buckets
}
