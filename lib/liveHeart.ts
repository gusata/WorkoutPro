import { timeInZones, zoneFor } from '@/lib/cardio'
import type { HeartSample } from '@/lib/health'

/** A reading older than this is not "live" anymore (watch out of sync, taken off...). */
export const LIVE_MAX_AGE_MS = 3 * 60_000
/** How often Health Connect is asked for changes while a workout is running. */
export const ACTIVE_CHANGES_INTERVAL_MS = 5_000
/** Share of the heart-rate reserve above resting HR that counts as "recovered". */
export const RECOVERY_RESERVE_SHARE = 0.4

/** The latest reading if it is recent enough to show as live. */
export function freshSample(latest: HeartSample | null | undefined, now: number = Date.now(), maxAge = LIVE_MAX_AGE_MS): HeartSample | null {
  if (!latest) return null
  const age = now - new Date(latest.time).getTime()
  return age >= -60_000 && age <= maxAge ? latest : null
}

/** "agora", "há 20 s", "há 2 min". */
export function formatSampleAge(time: Date, now: number = Date.now()) {
  const seconds = Math.max(0, Math.round((now - time.getTime()) / 1000))
  if (seconds < 10) return 'agora'
  if (seconds < 60) return `há ${seconds} s`
  return `há ${Math.floor(seconds / 60)} min`
}

/**
 * Heart rate under which a rest counts as recovered. A value from settings wins;
 * otherwise resting + 40% of the reserve (Karvonen), or 60% of max HR without resting HR.
 */
export function recoveryThreshold(options: { custom?: number | null; maxHr: number | null; restingHr: number | null }): number | null {
  if (options.custom && options.custom > 40) return Math.round(options.custom)
  const { maxHr, restingHr } = options
  if (!maxHr) return null
  if (restingHr && restingHr > 30 && restingHr < maxHr) return Math.round(restingHr + RECOVERY_RESERVE_SHARE * (maxHr - restingHr))
  return Math.round(maxHr * 0.6)
}

/** A rest is recovered when a fresh reading taken during the rest is at or below the threshold. */
export function isRecovered(latest: HeartSample | null | undefined, restStartedAt: number | null, threshold: number | null, now: number = Date.now()) {
  const sample = freshSample(latest, now)
  if (!sample || restStartedAt == null || threshold == null) return false
  return new Date(sample.time).getTime() >= restStartedAt && sample.bpm <= threshold
}

/**
 * Rough active calories for a strength session: (MET − 1) × kg × hours, with MET 5
 * ("vigorous weight lifting" is 6, general resistance training ~3.5). Null without body weight.
 */
export function estimateStrengthCalories(durationSeconds: number, bodyWeightKg: number | null | undefined, met = 5): number | null {
  if (!bodyWeightKg || bodyWeightKg < 30 || durationSeconds < 60) return null
  return Math.round((met - 1) * bodyWeightKg * (durationSeconds / 3600))
}

export interface LiveZones {
  bpm: number | null
  zone: number
  /** Seconds per zone 1..5 since the start. */
  zones: number[]
  avg: number | null
  max: number | null
}

/** Current zone and time in each zone from the samples recorded since the activity started. */
export function liveZones(samples: HeartSample[], startedAt: number, maxHr: number | null, now: number = Date.now()): LiveZones {
  const inRange = samples.filter((sample) => sample.time.getTime() >= startedAt && sample.time.getTime() <= now + 60_000)
  const latest = freshSample(inRange.at(-1), now)
  const bpms = inRange.map((sample) => sample.bpm)
  // The last sample only counts up to now while it is still fresh.
  const end = latest ? new Date(now) : undefined
  return {
    bpm: latest?.bpm ?? null,
    zone: latest && maxHr ? zoneFor(latest.bpm, maxHr) : -1,
    zones: maxHr && inRange.length ? timeInZones(inRange, maxHr, end) : [0, 0, 0, 0, 0],
    avg: bpms.length ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : null,
    max: bpms.length ? Math.max(...bpms) : null,
  }
}

/** Merges newly read samples into the list (dedup by timestamp, sorted). */
export function mergeSamples(current: HeartSample[], incoming: HeartSample[]): HeartSample[] {
  const byTime = new Map<number, HeartSample>()
  for (const sample of [...current, ...incoming]) byTime.set(sample.time.getTime(), sample)
  return [...byTime.values()].sort((a, b) => a.time.getTime() - b.time.getTime())
}
