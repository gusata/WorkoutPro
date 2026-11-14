import { endOfWeek, isWithinInterval, startOfWeek } from 'date-fns'
import type { CardioActivity, CardioSession, UserPreferences } from '@/types'

export const CARDIO_ACTIVITIES: Array<{ value: CardioActivity; label: string; hasDistance: boolean }> = [
  { value: 'running', label: 'Corrida', hasDistance: true },
  { value: 'walking', label: 'Caminhada', hasDistance: true },
  { value: 'cycling', label: 'Bicicleta', hasDistance: true },
  { value: 'treadmill', label: 'Esteira', hasDistance: true },
  { value: 'elliptical', label: 'Elíptico', hasDistance: false },
  { value: 'rowing', label: 'Remo', hasDistance: true },
  { value: 'stairs', label: 'Escada', hasDistance: false },
  { value: 'swimming', label: 'Natação', hasDistance: true },
  { value: 'hiit', label: 'HIIT', hasDistance: false },
  { value: 'hiking', label: 'Trilha', hasDistance: true },
  { value: 'other', label: 'Outro', hasDistance: false },
]

export function cardioLabel(activity: CardioActivity) {
  return CARDIO_ACTIVITIES.find((item) => item.value === activity)?.label ?? 'Cardio'
}

export const DEFAULT_CARDIO_GOAL = 150

/** Health store workout types that are strength work (already logged by the app itself). */
const STRENGTH_TYPES = new Set([
  'strengthTraining', 'traditionalStrengthTraining', 'functionalStrengthTraining', 'weightlifting', 'coreTraining',
  'calisthenics', 'backExtension', 'barbellShoulderPress', 'benchPress', 'deadlift', 'latPullDown', 'lunge', 'plank',
  'crunch', 'dumbbellCurlLeftArm', 'dumbbellCurlRightArm', 'dumbbellFrontRaise', 'dumbbellLateralRaise',
  'dumbbellTricepsExtensionLeftArm', 'dumbbellTricepsExtensionRightArm', 'dumbbellTricepsExtensionTwoArm',
  'benchSitUp', 'forwardTwist', 'upperTwist', 'stretching', 'flexibility', 'yoga', 'pilates', 'mindAndBody',
  'meditation', 'guidedBreathing', 'cooldown', 'preparationAndRecovery', 'other',
])

/** Maps a Health Connect / HealthKit workout type to a cardio activity, or null when it isn't cardio. */
export function activityFromHealthType(type: string): CardioActivity | null {
  if (STRENGTH_TYPES.has(type)) return null
  if (type === 'runningTreadmill') return 'treadmill'
  if (/running|trackAndField/i.test(type)) return 'running'
  if (/walking|wheelchairWalk/i.test(type)) return 'walking'
  if (/hiking|snowshoeing/i.test(type)) return 'hiking'
  if (/cycling|biking|handCycling/i.test(type)) return 'cycling'
  if (/elliptical/i.test(type)) return 'elliptical'
  if (/rowing|paddl/i.test(type)) return 'rowing'
  if (/stair|stepTraining/i.test(type)) return 'stairs'
  if (/swimming|waterFitness|waterPolo/i.test(type)) return 'swimming'
  if (/highIntensity|bootCamp|burpee|jumpRope|jumpingJack|crossTraining|mixedCardio|kickboxing|boxing/i.test(type)) return 'hiit'
  return null
}

// ---------------------------------------------------------------------------
// Heart-rate zones
// ---------------------------------------------------------------------------

export const ZONES = [
  { label: 'Zona 1', name: 'Muito leve', min: 0.5, color: '#8e8e93' },
  { label: 'Zona 2', name: 'Leve', min: 0.6, color: '#30b0c7' },
  { label: 'Zona 3', name: 'Moderada', min: 0.7, color: '#34c759' },
  { label: 'Zona 4', name: 'Forte', min: 0.8, color: '#ff9f0a' },
  { label: 'Zona 5', name: 'Máxima', min: 0.9, color: '#ff375f' },
] as const

/** Measured max HR, else Tanaka's age formula (208 − 0.7 × age). Null without age. */
export function maxHeartRate(preferences: UserPreferences | undefined, now: Date = new Date()): number | null {
  if (preferences?.maxHeartRate) return preferences.maxHeartRate
  if (!preferences?.birthYear) return null
  const age = now.getFullYear() - preferences.birthYear
  if (age < 10 || age > 100) return null
  return Math.round(208 - 0.7 * age)
}

export function zoneFor(bpm: number, maxHr: number): number {
  const pct = bpm / maxHr
  for (let index = ZONES.length - 1; index >= 0; index -= 1) if (pct >= ZONES[index].min) return index
  return -1
}

export function zoneRanges(maxHr: number) {
  return ZONES.map((zone, index) => ({
    ...zone,
    from: Math.round(maxHr * zone.min),
    to: index === ZONES.length - 1 ? maxHr : Math.round(maxHr * ZONES[index + 1].min) - 1,
  }))
}

/**
 * Seconds per zone from heart-rate samples. Each sample counts until the next one,
 * capped at 60 s so gaps in the recording don't inflate a zone.
 */
export function timeInZones(samples: Array<{ time: Date; bpm: number }>, maxHr: number, end?: Date): number[] {
  const zones = [0, 0, 0, 0, 0]
  const sorted = [...samples].sort((a, b) => a.time.getTime() - b.time.getTime())
  sorted.forEach((sample, index) => {
    const next = sorted[index + 1]?.time ?? end ?? new Date(sample.time.getTime() + 5000)
    const seconds = Math.min(60, Math.max(0, (next.getTime() - sample.time.getTime()) / 1000))
    const zone = zoneFor(sample.bpm, maxHr)
    if (zone >= 0) zones[zone] += seconds
  })
  return zones.map(Math.round)
}

// ---------------------------------------------------------------------------
// Formatting / aggregates
// ---------------------------------------------------------------------------

export function formatDistance(meters: number | null | undefined) {
  if (!meters) return '—'
  return meters >= 1000 ? `${(meters / 1000).toFixed(meters >= 10_000 ? 1 : 2).replace('.', ',')} km` : `${Math.round(meters)} m`
}

/** Minutes per kilometer ("5:42 /km"), for running-like activities. */
export function formatPace(seconds: number, meters: number | null | undefined) {
  if (!meters || meters < 100 || seconds <= 0) return null
  const perKm = seconds / (meters / 1000)
  const minutes = Math.floor(perKm / 60)
  const rest = Math.round(perKm % 60)
  return `${minutes}:${String(rest === 60 ? 0 : rest).padStart(2, '0')} /km`
}

export function formatMinutes(seconds: number) {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}`
}

export function cardioMinutesInWeek(sessions: CardioSession[], now: Date = new Date()) {
  const interval = { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
  return Math.round(sessions
    .filter((session) => isWithinInterval(new Date(session.startedAt), interval))
    .reduce((total, session) => total + session.duration, 0) / 60)
}

/** Same workout already stored? Matches the health-store id, or the same start (±2 min) and activity. */
export function isDuplicateCardio(existing: CardioSession[], candidate: Pick<CardioSession, 'externalId' | 'startedAt' | 'activity'>) {
  return existing.some((item) =>
    (candidate.externalId && item.externalId === candidate.externalId) ||
    (item.activity === candidate.activity && Math.abs(new Date(item.startedAt).getTime() - new Date(candidate.startedAt).getTime()) < 120_000)
  )
}
