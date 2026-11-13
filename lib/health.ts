import { Capacitor } from '@capacitor/core'
import { format } from 'date-fns'

/**
 * Apple Health (iOS) / Health Connect (Android) bridge. Everything is optional:
 * on the web, or when the user declines, the app keeps working with local data only.
 */

export interface HealthBodyEntry {
  date: Date
  weight: number | null
  bodyFat: number | null
}

const READ_TYPES = [
  'weight', 'bodyFat', 'heartRate', 'restingHeartRate',
  'workouts', 'steps', 'distance', 'calories', 'sleep', 'heartRateVariability', 'vo2Max',
] as const
const WRITE_TYPES = ['weight'] as const

/**
 * Resolves to the module, never to the plugin itself: Capacitor plugins are proxies
 * that answer any property, so returning one from an async function makes the
 * Promise call a non-existent native `Health.then()` and reject.
 */
async function loadModule() {
  return import('@capgo/capacitor-health')
}

export function healthPlatformName() {
  if (typeof window === 'undefined') return 'Saúde'
  return Capacitor.getPlatform() === 'ios' ? 'Apple Saúde' : 'Health Connect'
}

export async function healthAvailable(): Promise<{ available: boolean; reason?: string }> {
  if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) {
    return { available: false, reason: 'Disponível no app instalado no celular.' }
  }
  try {
    const result = await (await loadModule()).Health.isAvailable()
    return { available: result.available, reason: result.reason }
  } catch {
    return { available: false, reason: 'Não foi possível acessar o app de saúde deste aparelho.' }
  }
}

export async function connectHealth(): Promise<boolean> {
  // History access lets trends (resting HR, HRV, VO2 max) look back further than 30 days.
  const status = await (await loadModule()).Health.requestAuthorization({ read: [...READ_TYPES], write: [...WRITE_TYPES], requestHistoryAccess: true })
  return status.readAuthorized.length > 0 || status.writeAuthorized.length > 0
}

/** Data types the user has not granted yet (without prompting). */
export async function missingHealthPermissions(): Promise<string[]> {
  try {
    const status = await (await loadModule()).Health.checkAuthorization({ read: [...READ_TYPES], write: [...WRITE_TYPES] })
    return [...status.readDenied, ...status.writeDenied]
  } catch {
    return [...READ_TYPES]
  }
}

export async function openHealthSettings() {
  await (await loadModule()).Health.openHealthConnectSettings()
}

/** One entry per day with the latest weight / body fat recorded in the health store. */
export async function readBodyEntries(days = 30): Promise<HealthBodyEntry[]> {
  const { Health } = await loadModule()
  const startDate = new Date(Date.now() - days * 86_400_000).toISOString()
  const endDate = new Date().toISOString()
  const [weights, fats] = await Promise.all([
    Health.readSamples({ dataType: 'weight', startDate, endDate, limit: 200, ascending: true }).catch(() => ({ samples: [] })),
    Health.readSamples({ dataType: 'bodyFat', startDate, endDate, limit: 200, ascending: true }).catch(() => ({ samples: [] })),
  ])
  const byDay = new Map<string, HealthBodyEntry>()
  const entryFor = (iso: string) => {
    const date = new Date(iso)
    const key = format(date, 'yyyy-MM-dd')
    const entry = byDay.get(key) ?? { date, weight: null, bodyFat: null }
    byDay.set(key, entry)
    return entry
  }
  for (const sample of weights.samples) entryFor(sample.startDate).weight = Math.round(sample.value * 10) / 10
  for (const sample of fats.samples) {
    // HealthKit reports a 0..1 fraction; Health Connect reports 0..100.
    const pct = sample.value <= 1 ? sample.value * 100 : sample.value
    entryFor(sample.startDate).bodyFat = Math.round(pct * 10) / 10
  }
  return [...byDay.values()].sort((a, b) => a.date.getTime() - b.date.getTime())
}

export async function writeWeight(weight: number, date: Date = new Date()) {
  await (await loadModule()).Health.saveSample({ dataType: 'weight', value: weight, startDate: date.toISOString() })
}

/** Average heart rate recorded between two instants (e.g. during a workout), if any. */
export async function averageHeartRate(start: Date, end: Date): Promise<number | null> {
  try {
    const { samples } = await (await loadModule()).Health.readSamples({
      dataType: 'heartRate', startDate: start.toISOString(), endDate: end.toISOString(), limit: 1000,
    })
    if (samples.length === 0) return null
    return Math.round(samples.reduce((total, sample) => total + sample.value, 0) / samples.length)
  } catch {
    return null
  }
}

export async function latestRestingHeartRate(): Promise<number | null> {
  try {
    const { samples } = await (await loadModule()).Health.readSamples({
      dataType: 'restingHeartRate', startDate: new Date(Date.now() - 14 * 86_400_000).toISOString(), limit: 1,
    })
    return samples[0] ? Math.round(samples[0].value) : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Cardio, sleep and heart metrics
// ---------------------------------------------------------------------------

export interface HealthWorkout {
  externalId: string | null
  type: string
  startedAt: Date
  endedAt: Date
  duration: number
  distance: number | null
  calories: number | null
  sourceName: string | null
}

const DAY = 86_400_000

export async function readWorkouts(days = 30): Promise<HealthWorkout[]> {
  const { Health } = await loadModule()
  const result: HealthWorkout[] = []
  let anchor: string | undefined
  for (let page = 0; page < 10; page += 1) {
    const response = await Health.queryWorkouts({
      startDate: new Date(Date.now() - days * DAY).toISOString(), endDate: new Date().toISOString(), limit: 50, anchor,
    })
    for (const workout of response.workouts) {
      result.push({
        externalId: workout.platformId ?? null,
        type: workout.workoutType,
        startedAt: new Date(workout.startDate),
        endedAt: new Date(workout.endDate),
        duration: Math.round(workout.duration),
        distance: workout.totalDistance ?? null,
        calories: workout.totalEnergyBurned != null ? Math.round(workout.totalEnergyBurned) : null,
        sourceName: workout.sourceName ?? null,
      })
    }
    anchor = response.anchor || undefined
    if (!anchor || response.workouts.length === 0) break
  }
  return result
}

export interface HeartSample {
  time: Date
  bpm: number
}

export async function heartRateSamples(start: Date, end: Date): Promise<HeartSample[]> {
  try {
    const { samples } = await (await loadModule()).Health.readSamples({
      dataType: 'heartRate', startDate: start.toISOString(), endDate: end.toISOString(), limit: 5000, ascending: true,
    })
    return samples.map((sample) => ({ time: new Date(sample.startDate), bpm: Math.round(sample.value) }))
  } catch {
    return []
  }
}

export type SleepStageName = 'awake' | 'light' | 'deep' | 'rem' | 'asleep'

export interface SleepNight {
  start: Date
  end: Date
  /** Minutes in bed (session length). */
  inBed: number
  /** Minutes asleep (session length minus awake time). */
  asleep: number
  stages: Array<{ start: Date; end: Date; stage: SleepStageName }>
  minutes: Record<SleepStageName, number>
  hasStages: boolean
  sourceName: string | null
}

export async function readSleep(days = 14): Promise<SleepNight[]> {
  const { Health } = await loadModule()
  const { samples } = await Health.readSamples({
    dataType: 'sleep', startDate: new Date(Date.now() - days * DAY).toISOString(), endDate: new Date().toISOString(), limit: 100, ascending: true,
  })
  return samples.map((sample) => {
    const start = new Date(sample.startDate)
    const end = new Date(sample.endDate)
    const stages = (sample.stages ?? [])
      .filter((stage) => stage.stage !== 'inBed')
      .map((stage) => ({ start: new Date(stage.startDate), end: new Date(stage.endDate), stage: stage.stage as SleepStageName }))
    const minutes: Record<SleepStageName, number> = { awake: 0, light: 0, deep: 0, rem: 0, asleep: 0 }
    for (const stage of stages) minutes[stage.stage] += (stage.end.getTime() - stage.start.getTime()) / 60_000
    const inBed = Math.round((end.getTime() - start.getTime()) / 60_000)
    const hasStages = stages.length > 0
    return {
      start, end, inBed, stages, hasStages, sourceName: sample.sourceName ?? null,
      minutes: Object.fromEntries(Object.entries(minutes).map(([key, value]) => [key, Math.round(value)])) as Record<SleepStageName, number>,
      asleep: hasStages ? Math.round(inBed - minutes.awake) : inBed,
    }
  }).filter((night) => night.inBed >= 60)
}

export interface DailyValue {
  date: Date
  value: number
}

async function readSeries(dataType: 'restingHeartRate' | 'heartRateVariability' | 'vo2Max', days: number): Promise<DailyValue[]> {
  try {
    const { samples } = await (await loadModule()).Health.readSamples({
      dataType, startDate: new Date(Date.now() - days * DAY).toISOString(), endDate: new Date().toISOString(), limit: 1000, ascending: true,
    })
    // One value per day (the day's average), so watch spot-checks don't dominate.
    const byDay = new Map<string, { date: Date; total: number; count: number }>()
    for (const sample of samples) {
      const date = new Date(sample.startDate)
      const key = date.toDateString()
      const entry = byDay.get(key) ?? { date, total: 0, count: 0 }
      entry.total += sample.value
      entry.count += 1
      byDay.set(key, entry)
    }
    return [...byDay.values()]
      .map((entry) => ({ date: entry.date, value: Math.round((entry.total / entry.count) * 10) / 10 }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
  } catch {
    return []
  }
}

export const readRestingHeartRate = (days = 90) => readSeries('restingHeartRate', days)
export const readHrv = (days = 90) => readSeries('heartRateVariability', days)
export const readVo2Max = (days = 365) => readSeries('vo2Max', days)

export async function readDailySteps(days = 14): Promise<DailyValue[]> {
  try {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - (days - 1))
    const { samples } = await (await loadModule()).Health.queryAggregated({
      dataType: 'steps', startDate: start.toISOString(), endDate: new Date().toISOString(), bucket: 'day', aggregation: 'sum',
    })
    return samples.map((sample) => ({ date: new Date(sample.startDate), value: Math.round(sample.value) }))
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Heart rate (live)
// ---------------------------------------------------------------------------

export interface HeartPoint {
  /** Start of a 5-minute bucket. */
  time: Date
  avg: number
  min: number
  max: number
}

export interface HeartToday {
  latest: HeartSample | null
  points: HeartPoint[]
  min: number | null
  max: number | null
  avg: number | null
}

const BUCKET_MS = 5 * 60_000

/** Heart rate since midnight, grouped into 5-minute buckets (keeps the cache small). */
export async function readHeartToday(now: Date = new Date()): Promise<HeartToday> {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const samples = await heartRateSamples(start, now)
  if (samples.length === 0) return { latest: null, points: [], min: null, max: null, avg: null }
  const buckets = new Map<number, number[]>()
  for (const sample of samples) {
    const key = Math.floor(sample.time.getTime() / BUCKET_MS) * BUCKET_MS
    buckets.set(key, [...(buckets.get(key) ?? []), sample.bpm])
  }
  const points = [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([key, values]) => ({
    time: new Date(key),
    avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    min: Math.min(...values),
    max: Math.max(...values),
  }))
  const bpms = samples.map((sample) => sample.bpm)
  const latest = samples.reduce((newest, sample) => sample.time > newest.time ? sample : newest, samples[0])
  return {
    latest,
    points,
    min: Math.min(...bpms),
    max: Math.max(...bpms),
    avg: Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length),
  }
}

export interface HeartDay {
  date: Date
  min: number
  max: number
  avg: number
}

/** Daily min / average / max for the last days, aggregated by Health Connect. */
export async function readHeartDaily(days = 7): Promise<HeartDay[]> {
  try {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - (days - 1))
    const { samples } = await (await loadModule()).Health.queryAggregated({
      dataType: 'heartRate', startDate: start.toISOString(), endDate: new Date().toISOString(), bucket: 'day', aggregation: ['min', 'average', 'max'],
    })
    return samples
      .filter((sample) => sample.values.max != null)
      .map((sample) => ({
        date: new Date(sample.startDate),
        min: Math.round(sample.values.min ?? sample.value),
        max: Math.round(sample.values.max ?? sample.value),
        avg: Math.round(sample.values.average ?? sample.value),
      }))
  } catch {
    return []
  }
}

export async function readStepsToday(): Promise<number | null> {
  const days = await readDailySteps(1)
  return days.at(-1)?.value ?? null
}
