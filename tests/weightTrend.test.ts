import { describe, expect, it } from 'vitest'
import { dailyAverages, formatWeeklyRate, smoothWeight, summarizeWeightTrend, weeklyRate } from '@/lib/weightTrend'

const START = new Date('2026-06-01T07:00:00-03:00').getTime()
const at = (day: number, hour = 0) => new Date(START + day * 86_400_000 + hour * 3_600_000)

describe('smoothWeight', () => {
  it('returns nothing for no data and the value itself for one reading', () => {
    expect(smoothWeight([])).toEqual([])
    expect(smoothWeight([{ date: at(0), value: 80 }])).toEqual([{ date: at(0), value: 80 }])
  })

  it('averages same-day readings instead of dropping them', () => {
    const daily = dailyAverages([{ date: at(0), value: 80 }, { date: at(0, 10), value: 81 }, { date: at(1), value: 79 }])
    expect(daily.map((point) => point.value)).toEqual([80.5, 79])
  })

  it('matches a classic 10-day EMA for daily readings', () => {
    const values = [80, 81, 79, 80.5, 79.5]
    const trend = smoothWeight(values.map((value, day) => ({ date: at(day), value })))
    const alpha = 2 / 11
    let ema = values[0]
    values.slice(1).forEach((value) => { ema += alpha * (value - ema) })
    expect(trend.at(-1)!.value).toBeCloseTo(ema, 10)
  })

  it('time-weights gaps: one reading after 10 days equals ten daily steps toward it', () => {
    const gap = smoothWeight([{ date: at(0), value: 80 }, { date: at(10), value: 78 }])
    let ema = 80
    for (let index = 0; index < 10; index += 1) ema += (2 / 11) * (78 - ema)
    expect(gap[1].value).toBeCloseTo(ema, 10)
    // A gap moves the trend more than a next-day reading would.
    const nextDay = smoothWeight([{ date: at(0), value: 80 }, { date: at(1), value: 78 }])
    expect(80 - gap[1].value).toBeGreaterThan(80 - nextDay[1].value)
  })

  it('does not depend on input order', () => {
    const points = [{ date: at(3), value: 79 }, { date: at(0), value: 80 }, { date: at(9), value: 78.4 }]
    expect(smoothWeight(points)).toEqual(smoothWeight([...points].sort((a, b) => a.date.getTime() - b.date.getTime())))
  })
})

describe('weekly rate and summary', () => {
  it('needs at least a week of data', () => {
    expect(weeklyRate(smoothWeight([{ date: at(0), value: 80 }, { date: at(5), value: 79 }]))).toBeNull()
    expect(summarizeWeightTrend([{ date: at(0), value: 80 }, { date: at(3), value: 79.6 }]).text).toContain('pelo menos uma semana')
  })

  it('detects a steady loss of ~0.5 kg/week with irregular weigh-ins', () => {
    const days = [0, 1, 4, 9, 10, 15, 21, 22, 30, 35, 42, 49, 56]
    const points = days.map((day) => ({ date: at(day), value: 85 - (day / 7) * 0.5 }))
    const summary = summarizeWeightTrend(points)
    expect(summary.direction).toBe('down')
    expect(summary.rate!).toBeLessThan(-0.4)
    expect(summary.rate!).toBeGreaterThan(-0.6)
    expect(summary.text).toContain('Em queda')
    expect(summary.text).toContain('kg/semana')
  })

  it('calls small noise stable', () => {
    const points = Array.from({ length: 30 }, (_, day) => ({ date: at(day), value: 80 + (day % 2 === 0 ? 0.3 : -0.3) }))
    const summary = summarizeWeightTrend(points)
    expect(summary.direction).toBe('stable')
    expect(summary.text).toContain('estável')
  })

  it('formats the rate with a typographic minus and comma', () => {
    expect(formatWeeklyRate(-0.34)).toBe('−0,3 kg/semana')
    expect(formatWeeklyRate(0.25)).toBe('+0,3 kg/semana')
    expect(formatWeeklyRate(0.02)).toBe('0 kg/semana')
  })
})
