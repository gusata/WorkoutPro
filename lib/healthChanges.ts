import { Capacitor, registerPlugin } from '@capacitor/core'

export interface HealthChangesResult {
  available: boolean
  /** No usable sync token (first run, permissions changed, token expired): do one full read. */
  reset?: boolean
  /** Health Connect types with new / edited records since the last check; "deleted" for deletions. */
  changed?: string[]
}

export interface HealthWriteStatus {
  available: boolean
  /** WRITE_EXERCISE (strength sessions). */
  exercise: boolean
  /** WRITE_ACTIVE_CALORIES_BURNED. */
  calories: boolean
}

export interface ExerciseSessionInput {
  /** Stable id (the app's session id): Health Connect upserts, so re-writing never duplicates. */
  clientRecordId: string
  title: string
  notes?: string
  startTime: string
  endTime: string
  exerciseType?: 'strength' | 'weightlifting'
  /** Kilocalories; written as an ActiveCaloriesBurnedRecord when granted. */
  activeCalories?: number | null
  /** Higher versions replace older ones with the same clientRecordId. */
  version?: number
}

export interface ExerciseSessionResult {
  written: boolean
  calories?: boolean
  reason?: 'permission' | 'unavailable'
}

interface HealthChangesPluginInterface {
  check(): Promise<HealthChangesResult>
  reset(): Promise<void>
  writePermissions(): Promise<HealthWriteStatus>
  requestWritePermissions(): Promise<HealthWriteStatus>
  writeExerciseSession(options: ExerciseSessionInput): Promise<ExerciseSessionResult>
}

/** Native Health Connect Changes API + session writes (android/app/.../HealthChangesPlugin.kt). Android only. */
const HealthChanges = registerPlugin<HealthChangesPluginInterface>('HealthChanges')

function isAndroid() {
  return typeof window !== 'undefined' && Capacitor.getPlatform() === 'android'
}

/** `null` where the Changes API does not exist (web, iOS): callers fall back to polling. */
export async function checkHealthChanges(): Promise<HealthChangesResult | null> {
  if (!isAndroid()) return null
  return HealthChanges.check()
}

/** `null` off Android: there is no way to write sessions there. */
export async function healthWriteStatus(): Promise<HealthWriteStatus | null> {
  if (!isAndroid()) return null
  return HealthChanges.writePermissions()
}

/** Shows the Health Connect sheet only for the write permissions still missing. */
export async function requestHealthWritePermissions(): Promise<HealthWriteStatus | null> {
  if (!isAndroid()) return null
  return HealthChanges.requestWritePermissions()
}

export async function writeExerciseSession(input: ExerciseSessionInput): Promise<ExerciseSessionResult | null> {
  if (!isAndroid()) return null
  return HealthChanges.writeExerciseSession(input)
}
