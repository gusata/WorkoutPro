import { format } from 'date-fns'

export interface WeightPoint {
  date: Date
  value: number
}

const DAY_MS = 86_400_000

/** Same-day readings averaged into one point at the day's first reading time, oldest first. */
export function dailyAverages(points: WeightPoint[]): WeightPoint[] {
  const days = new Map<string, { date: Date; total: number; count: number }>()
  for (const point of points) {
    if (!Number.isFinite(point.value)) continue
    const key = format(point.date, 'yyyy-MM-dd')
    const entry = days.get(key)
    if (entry) {
      entry.total += point.value
      entry.count += 1
      if (point.date < entry.date) entry.date = point.date
    } else {
      days.set(key, { date: point.date, total: point.value, count: 1 })
    }
  }
  return [...days.values()]
    .map((entry) => ({ date: entry.date, value: entry.total / entry.count }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
}

/**
 * Time-weighted exponential moving average. A classic N-day EMA uses
 * α = 2/(N+1) per daily step; for irregular gaps the weight of the new reading is
 * 1 − (1 − α)^Δdays, so a reading after a 10-day gap moves the trend much more than
 * one taken the next morning, and the result does not depend on how often you weigh in.
 */
export function smoothWeight(points: WeightPoint[], days = 10): WeightPoint[] {
  const daily = dailyAverages(points)
  if (daily.length === 0) return []
  const decay = 1 - 2 / (days + 1)
  const result: WeightPoint[] = [{ date: daily[0].date, value: daily[0].value }]
  for (let index = 1; index < daily.length; index += 1) {
    const gap = Math.max(0, (daily[index].date.getTime() - daily[index - 1].date.getTime()) / DAY_MS)
    const alpha = 1 - Math.pow(decay, gap)
    const previous = result[index - 1].value
    result.push({ date: daily[index].date, value: previous + alpha * (daily[index].value - previous) })
  }
  return result
}

/** Trend value at a moment, linearly interpolated between smoothed points. */
function trendAt(trend: WeightPoint[], time: number): number {
  if (time <= trend[0].date.getTime()) return trend[0].value
  for (let index = 1; index < trend.length; index += 1) {
    const b = trend[index]
    if (b.date.getTime() >= time) {
      const a = trend[index - 1]
      const span = b.date.getTime() - a.date.getTime()
      return span <= 0 ? b.value : a.value + ((time - a.date.getTime()) / span) * (b.value - a.value)
    }
  }
  return trend[trend.length - 1].value
}

/**
 * Weekly rate of change of the smoothed trend over the last `windowDays` (or the
 * whole history when shorter). Null with less than a week of data.
 */
export function weeklyRate(trend: WeightPoint[], windowDays = 28): number | null {
  if (trend.length < 2) return null
  const end = trend[trend.length - 1].date.getTime()
  const start = Math.max(trend[0].date.getTime(), end - windowDays * DAY_MS)
  const spanDays = (end - start) / DAY_MS
  if (spanDays < 7) return null
  return ((trend[trend.length - 1].value - trendAt(trend, start)) / spanDays) * 7
}

function formatKg(value: number) {
  const rounded = Math.round(Math.abs(value) * 10) / 10
  return String(rounded).replace('.', ',')
}

/** "−0,3 kg/semana" (typographic minus). */
export function formatWeeklyRate(rate: number): string {
  const rounded = Math.round(rate * 10) / 10
  if (rounded === 0) return '0 kg/semana'
  return `${rounded > 0 ? '+' : '−'}${formatKg(rounded)} kg/semana`
}

export interface WeightTrendSummary {
  trend: WeightPoint[]
  rate: number | null
  /** Latest smoothed value. */
  current: number | null
  direction: 'down' | 'up' | 'stable' | null
  text: string | null
}

/** Smoothed series, weekly rate and a short pt-BR description. */
export function summarizeWeightTrend(points: WeightPoint[], days = 10): WeightTrendSummary {
  const trend = smoothWeight(points, days)
  const rate = weeklyRate(trend)
  const current = trend.length ? trend[trend.length - 1].value : null
  if (rate == null || current == null) {
    return { trend, rate, current, direction: null, text: trend.length >= 2 ? 'Registre por pelo menos uma semana para ver a tendência.' : null }
  }
  // Under ~0.1 kg/week (or 0.1% of body weight) is noise for most people.
  const threshold = Math.max(0.1, current * 0.001)
  const direction = Math.abs(rate) < threshold ? 'stable' : rate < 0 ? 'down' : 'up'
  const text = direction === 'stable'
    ? `Peso estável, em torno de ${formatKg(current)} kg.`
    : `${direction === 'down' ? 'Em queda' : 'Em alta'}: ${formatWeeklyRate(rate)} na tendência das últimas semanas.`
  return { trend, rate, current, direction, text }
}
