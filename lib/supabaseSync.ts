'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { db, getProfile } from '@/lib/db'
import { requireSupabase } from '@/lib/supabaseClient'
import { queueFullSync, queueSync } from '@/lib/syncQueue'
import { reportError } from '@/lib/observability'
import { reconcileProfile } from '@/lib/profileStats'
import { clearSyncCursors, hasSyncCursor, readCursor, writeCursor } from '@/lib/syncCursor'
import type {
  AchievementRecord, BodyMeasurement, CardioSession, Exercise, MuscleGroup, SessionExercise,
  SyncConflict, SyncEntity, SyncQueueItem, UserProfile, Workout, WorkoutSession,
} from '@/types'

interface CloudBase { id: string; updated_at: string; deleted_at: string | null }
interface CloudProfile {
  id: string; name: string; level: number; xp: number; total_volume: number; total_workouts: number
  streak: number; longest_streak: number; available_equipment?: string[]; last_workout_date: string | null; created_at: string; updated_at: string
  preferences?: UserProfile['preferences'] | null; training_block?: (Omit<NonNullable<UserProfile['trainingBlock']>, 'startDate'> & { startDate: string }) | null
}
interface CloudWorkout extends CloudBase { name: string; color: string; icon: string; exercise_ids: string[]; exercise_configs?: Workout['exerciseConfigs']; scheduled_weekdays?: number[]; created_at: string }
interface CloudExercise extends CloudBase { name: string; muscle_group: string; notes: string; equipment?: string; machine_settings?: string; alternatives?: string[]; library_id?: string | null; created_at: string }
interface CloudWorkoutSession extends CloudBase {
  workout_id: string; started_at: string; finished_at: string | null; duration: number
  exercises: SessionExercise[]; total_volume: number; xp_earned: number; notes: string
}
interface CloudBodyMeasurement extends CloudBase {
  date: string; weight: number | null; body_fat: number | null; lean_mass: number | null
  chest: number | null; arm: number | null; forearm: number | null; waist: number | null
  hip: number | null; thigh: number | null; calf: number | null
}
interface CloudAchievement extends CloudBase { unlocked_at: string }
interface CloudCardio extends CloudBase {
  activity: string; started_at: string; duration: number; distance: number | null; calories: number | null
  avg_heart_rate: number | null; max_heart_rate: number | null; zones: number[] | null; effort: number | null
  source: string; external_id: string | null; source_name: string | null; notes: string
}
interface CloudSnapshot {
  profile: CloudProfile | null; workouts: CloudWorkout[]; exercises: CloudExercise[]
  sessions: CloudWorkoutSession[]; measurements: CloudBodyMeasurement[]; achievements: CloudAchievement[]
  cardio: CloudCardio[]
  /** False while the cloud database has not been migrated with the cardio table yet. */
  cardioAvailable: boolean
}

export type SyncPhase = 'idle' | 'syncing' | 'synced' | 'offline' | 'error' | 'conflict' | 'disabled'
export interface SyncOverview {
  phase: SyncPhase; pending: number; conflicts: number; lastSyncedAt: Date | null; message: string | null
}
export interface SyncResult {
  uploaded: number; conflicts: number; workouts: number; exercises: number
  sessions: number; measurements: number; achievements: number
  /** Cloud rows applied locally in this run. 0 means local stores don't need reloading. */
  pulled: number
}

const LAST_SYNC_KEY = 'workoutpro.last-synced-at.v1'
/**
 * The cursor is the newest server-side `updated_at` already applied (set by the
 * touch_updated_at trigger, so it is server clock). Re-reading a small window
 * covers transactions that committed late with an older now().
 */
const CURSOR_OVERLAP_MS = 2 * 60_000
const UPSERT_CHUNK = 50
const LOOKUP_CHUNK = 100
const ENTITY_ORDER: SyncEntity[] = ['profile', 'exercises', 'workouts', 'sessions', 'measurements', 'achievements', 'cardio']

/** PostgREST / Postgres error for a table that does not exist (schema not migrated yet). */
function isMissingTable(error: unknown) {
  const value = error as { code?: string; message?: string } | null
  return value?.code === '42P01' || value?.code === 'PGRST205' || /relation .* does not exist|could not find the table/i.test(value?.message ?? '')
}

export { clearSyncCursors, hasSyncCursor }

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size))
  return result
}

function storedLastSync() {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(LAST_SYNC_KEY)
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

let lastSyncedAt: Date | null = storedLastSync()
let runningSync: Promise<SyncResult> | null = null

export function compareSyncVersions(localUpdatedAt: Date, remoteUpdatedAt: Date): 'local' | 'remote' | 'equal' {
  const local = localUpdatedAt.getTime()
  const remote = remoteUpdatedAt.getTime()
  if (remote > local) return 'remote'
  if (local > remote) return 'local'
  return 'equal'
}

function isoDate(value: Date | string | null | undefined) {
  return value ? new Date(value).toISOString() : null
}

function serializeSessionExercises(exercises: SessionExercise[]) {
  return exercises.map((exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) => ({ ...set, completedAt: isoDate(set.completedAt) })),
  }))
}

function reviveSessionExercises(exercises: SessionExercise[] | null): SessionExercise[] {
  return (exercises ?? []).map((exercise) => ({
    exerciseId: exercise.exerciseId,
    sets: exercise.sets.map((set) => ({ ...set, completedAt: new Date(set.completedAt) })),
  }))
}

async function getCurrentUserId(client: SupabaseClient) {
  const { data, error } = await client.auth.getSession()
  if (error) throw error
  if (!data.session?.user.id) throw new Error('Nenhuma sessao Supabase ativa')
  return data.session.user.id
}

function tableName(entity: SyncEntity) {
  if (entity === 'sessions') return 'workout_sessions'
  if (entity === 'measurements') return 'body_measurements'
  if (entity === 'cardio') return 'cardio_sessions'
  if (entity === 'profile') return 'profiles'
  return entity
}

async function localEntity(entity: SyncEntity, entityId: string) {
  if (entity === 'profile') return db.profile.get('profile')
  if (entity === 'workouts') return db.workouts.get(entityId)
  if (entity === 'exercises') return db.exercises.get(entityId)
  if (entity === 'sessions') return db.sessions.get(entityId)
  if (entity === 'measurements') return db.measurements.get(entityId)
  if (entity === 'cardio') return db.cardio.get(entityId)
  return db.achievements.get(entityId)
}

function entityUpdatedAt(entity: Awaited<ReturnType<typeof localEntity>>): Date | null {
  return entity ? new Date(entity.updatedAt) : null
}

/** Cloud `updated_at` for many rows of one entity, in as few round trips as possible. */
async function remoteVersions(client: SupabaseClient, userId: string, entity: SyncEntity, entityIds: string[]) {
  const versions = new Map<string, Date>()
  if (entity === 'profile') {
    const { data, error } = await client.from('profiles').select('updated_at').eq('id', userId).maybeSingle<{ updated_at: string }>()
    if (error) throw error
    if (data?.updated_at) versions.set('profile', new Date(data.updated_at))
    return versions
  }
  for (const ids of chunk(entityIds, LOOKUP_CHUNK)) {
    const { data, error } = await client.from(tableName(entity)).select('id, updated_at').eq('user_id', userId).in('id', ids)
    if (error) throw error
    for (const row of (data ?? []) as Array<{ id: string; updated_at: string }>) versions.set(row.id, new Date(row.updated_at))
  }
  return versions
}

function payloadFor(
  entity: SyncEntity,
  value: NonNullable<Awaited<ReturnType<typeof localEntity>>>,
  userId: string
): Record<string, unknown> {
  if (entity === 'profile') {
    const item = value as UserProfile
    return {
      id: userId, name: item.name, level: item.level, xp: item.xp, total_volume: item.totalVolume,
      total_workouts: item.totalWorkouts, streak: item.streak, longest_streak: item.longestStreak,
      available_equipment: item.availableEquipment ?? [], last_workout_date: isoDate(item.lastWorkoutDate), created_at: isoDate(item.createdAt), updated_at: isoDate(item.updatedAt),
      preferences: item.preferences ?? {},
      training_block: item.trainingBlock ? { ...item.trainingBlock, startDate: new Date(item.trainingBlock.startDate).toISOString() } : null,
    }
  }
  if (entity === 'workouts') {
    const item = value as Workout
    return { id: item.id, user_id: userId, name: item.name, color: item.color, icon: item.icon,
      exercise_ids: item.exerciseIds, exercise_configs: item.exerciseConfigs ?? [], scheduled_weekdays: item.scheduledWeekdays ?? [],
      created_at: isoDate(item.createdAt), updated_at: isoDate(item.updatedAt), deleted_at: null }
  }
  if (entity === 'exercises') {
    const item = value as Exercise
    return { id: item.id, user_id: userId, name: item.name, muscle_group: item.muscleGroup, notes: item.notes,
      equipment: item.equipment ?? '', machine_settings: item.machineSettings ?? '', alternatives: item.alternatives ?? [],
      library_id: item.libraryId ?? null,
      created_at: isoDate(item.createdAt), updated_at: isoDate(item.updatedAt), deleted_at: null }
  }
  if (entity === 'sessions') {
    const item = value as WorkoutSession
    return { id: item.id, user_id: userId, workout_id: item.workoutId, started_at: isoDate(item.startedAt),
      finished_at: isoDate(item.finishedAt), duration: item.duration, exercises: serializeSessionExercises(item.exercises),
      total_volume: item.totalVolume, xp_earned: item.xpEarned, notes: item.notes,
      updated_at: isoDate(item.updatedAt), deleted_at: null }
  }
  if (entity === 'measurements') {
    const item = value as BodyMeasurement
    return { id: item.id, user_id: userId, date: isoDate(item.date), weight: item.weight, body_fat: item.bodyFat,
      lean_mass: item.leanMass, chest: item.chest, arm: item.arm, forearm: item.forearm, waist: item.waist,
      hip: item.hip, thigh: item.thigh, calf: item.calf, updated_at: isoDate(item.updatedAt), deleted_at: null }
  }
  if (entity === 'cardio') {
    const item = value as CardioSession
    return { id: item.id, user_id: userId, activity: item.activity, started_at: isoDate(item.startedAt), duration: item.duration,
      distance: item.distance, calories: item.calories, avg_heart_rate: item.avgHeartRate, max_heart_rate: item.maxHeartRate,
      zones: item.zones ?? null, effort: item.effort, source: item.source, external_id: item.externalId ?? null,
      source_name: item.sourceName ?? null, notes: item.notes, updated_at: isoDate(item.updatedAt), deleted_at: null }
  }
  const item = value as AchievementRecord
  return { id: item.id, user_id: userId, unlocked_at: isoDate(item.unlockedAt),
    updated_at: isoDate(item.updatedAt), deleted_at: null }
}

async function recordConflict(item: SyncQueueItem, localUpdatedAt: Date, remoteUpdatedAt: Date) {
  const conflict: SyncConflict = {
    id: `${item.entity}:${item.entityId}`, entity: item.entity, entityId: item.entityId,
    operation: item.operation, localUpdatedAt, remoteUpdatedAt, detectedAt: new Date(),
    reason: 'A nuvem contem uma versao mais recente que a alteracao local.',
  }
  await db.syncConflicts.put(conflict)
}

interface BatchResult { uploaded: number; conflicts: number }

/**
 * Uploads every queued change of one entity with one version lookup and chunked
 * upserts, instead of two sequential round trips per item.
 */
async function uploadEntityBatch(client: SupabaseClient, userId: string, entity: SyncEntity, items: SyncQueueItem[]): Promise<BatchResult> {
  const live = (await db.syncQueue.bulkGet(items.map((item) => item.id))).filter((item): item is SyncQueueItem => Boolean(item))
  if (live.length === 0) return { uploaded: 0, conflicts: 0 }

  const values = await Promise.all(live.map((item) => item.operation === 'delete' ? null : localEntity(entity, item.entityId)))
  const skipped: string[] = []
  const candidates: Array<{ item: SyncQueueItem; value: Awaited<ReturnType<typeof localEntity>> | null; localUpdatedAt: Date }> = []
  live.forEach((item, index) => {
    const value = values[index]
    const localUpdatedAt = item.operation === 'delete' ? new Date(item.createdAt) : entityUpdatedAt(value ?? undefined)
    if (item.operation === 'upsert' && (!value || !localUpdatedAt)) skipped.push(item.id)
    else candidates.push({ item, value, localUpdatedAt: localUpdatedAt! })
  })
  if (skipped.length) await db.syncQueue.bulkDelete(skipped)
  if (candidates.length === 0) return { uploaded: 0, conflicts: 0 }

  try {
    const cloud = await remoteVersions(client, userId, entity, candidates.map(({ item }) => item.entityId))
    const cloudVersion = (item: SyncQueueItem) => cloud.get(entity === 'profile' ? 'profile' : item.entityId)
    const conflicted: typeof candidates = []
    const accepted: typeof candidates = []
    for (const candidate of candidates) {
      const cloudUpdatedAt = cloudVersion(candidate.item)
      if (cloudUpdatedAt && compareSyncVersions(candidate.localUpdatedAt, cloudUpdatedAt) === 'remote') conflicted.push(candidate)
      else accepted.push(candidate)
    }
    for (const { item, localUpdatedAt } of conflicted) await recordConflict(item, localUpdatedAt, cloudVersion(item)!)

    const upserts = accepted.filter(({ item }) => item.operation === 'upsert')
    for (const group of chunk(upserts, UPSERT_CHUNK)) {
      const { error } = await client.from(tableName(entity))
        .upsert(group.map(({ value }) => payloadFor(entity, value!, userId)) as never, { onConflict: entity === 'profile' ? 'id' : 'user_id,id' })
      if (error) throw error
    }

    const deletes = accepted.filter(({ item }) => item.operation === 'delete' && entity !== 'profile')
    const deleteResults = await Promise.all(deletes.map(({ item }) => {
      const deletedAt = new Date(item.createdAt).toISOString()
      return client.from(tableName(entity)).update({ deleted_at: deletedAt, updated_at: deletedAt })
        .eq('user_id', userId).eq('id', item.entityId)
    }))
    const deleteError = deleteResults.find((result) => result.error)?.error
    if (deleteError) throw deleteError

    // Only the queue rows read above are removed; an edit queued meanwhile has a new id and stays.
    await db.transaction('rw', [db.syncQueue, db.syncConflicts], async () => {
      await db.syncQueue.bulkDelete(accepted.map(({ item }) => item.id))
      await db.syncConflicts.bulkDelete(accepted.map(({ item }) => `${item.entity}:${item.entityId}`))
    })
    return { uploaded: accepted.length, conflicts: conflicted.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha desconhecida'
    await db.transaction('rw', db.syncQueue, async () => {
      for (const { item } of candidates) {
        const current = await db.syncQueue.get(item.id)
        if (current) await db.syncQueue.update(item.id, { attempts: current.attempts + 1, lastError: message })
      }
    })
    throw error
  }
}

/** Full snapshot, or only rows changed since `since` (server clock) for incremental syncs. */
async function fetchCloudSnapshot(client: SupabaseClient, userId: string, since: string | null = null): Promise<CloudSnapshot> {
  const table = (name: string, column: 'id' | 'user_id') => {
    const query = client.from(name).select('*').eq(column, userId)
    return since ? query.gte('updated_at', since) : query
  }
  const results = await Promise.all([
    table('profiles', 'id').maybeSingle<CloudProfile>(),
    table('workouts', 'user_id'),
    table('exercises', 'user_id'),
    table('workout_sessions', 'user_id'),
    table('body_measurements', 'user_id'),
    table('achievements', 'user_id'),
  ])
  for (const result of results) if (result.error) throw result.error
  // Optional table: an older cloud schema without it must not break the whole sync.
  const cardioResult = await table('cardio_sessions', 'user_id')
  if (cardioResult.error && !isMissingTable(cardioResult.error)) throw cardioResult.error
  return {
    profile: results[0].data as CloudProfile | null,
    workouts: (results[1].data ?? []) as CloudWorkout[], exercises: (results[2].data ?? []) as CloudExercise[],
    sessions: (results[3].data ?? []) as CloudWorkoutSession[],
    measurements: (results[4].data ?? []) as CloudBodyMeasurement[],
    achievements: (results[5].data ?? []) as CloudAchievement[],
    cardio: cardioResult.error ? [] : ((cardioResult.data ?? []) as CloudCardio[]),
    cardioAvailable: !cardioResult.error,
  }
}

function snapshotRowCount(snapshot: CloudSnapshot) {
  return (snapshot.profile ? 1 : 0) + snapshot.workouts.length + snapshot.exercises.length + snapshot.sessions.length +
    snapshot.measurements.length + snapshot.achievements.length + snapshot.cardio.length
}

/** Newest server `updated_at` seen so far; the next incremental pull starts slightly before it. */
function snapshotCursor(snapshot: CloudSnapshot, previous: string | null): string | null {
  let newest = previous ? new Date(previous).getTime() : 0
  const rows: Array<{ updated_at: string }> = [
    ...(snapshot.profile ? [snapshot.profile] : []), ...snapshot.workouts, ...snapshot.exercises,
    ...snapshot.sessions, ...snapshot.measurements, ...snapshot.achievements, ...snapshot.cardio,
  ]
  for (const row of rows) newest = Math.max(newest, new Date(row.updated_at).getTime())
  return newest > 0 ? new Date(newest).toISOString() : previous
}

function snapshotIsEmpty(snapshot: CloudSnapshot) {
  return !snapshot.profile && snapshot.workouts.length + snapshot.exercises.length + snapshot.sessions.length +
    snapshot.measurements.length + snapshot.achievements.length + snapshot.cardio.length === 0
}

function fromCloudProfile(item: CloudProfile): UserProfile {
  return { id: 'profile', name: item.name, level: item.level, xp: item.xp, totalVolume: item.total_volume,
    totalWorkouts: item.total_workouts, streak: item.streak, longestStreak: item.longest_streak,
    availableEquipment: item.available_equipment ?? [], lastWorkoutDate: item.last_workout_date ? new Date(item.last_workout_date) : null,
    preferences: item.preferences ?? {},
    trainingBlock: item.training_block ? { ...item.training_block, startDate: new Date(item.training_block.startDate) } : null,
    createdAt: new Date(item.created_at), updatedAt: new Date(item.updated_at) }
}
function fromCloudWorkout(item: CloudWorkout): Workout {
  return { id: item.id, name: item.name, color: item.color, icon: item.icon, exerciseIds: item.exercise_ids,
    exerciseConfigs: item.exercise_configs ?? [], scheduledWeekdays: item.scheduled_weekdays ?? [],
    createdAt: new Date(item.created_at), updatedAt: new Date(item.updated_at) }
}
function fromCloudExercise(item: CloudExercise): Exercise {
  return { id: item.id, name: item.name, muscleGroup: item.muscle_group as MuscleGroup, notes: item.notes,
    equipment: item.equipment || undefined, machineSettings: item.machine_settings || undefined, alternatives: item.alternatives ?? [],
    libraryId: item.library_id || undefined,
    createdAt: new Date(item.created_at), updatedAt: new Date(item.updated_at) }
}
function fromCloudSession(item: CloudWorkoutSession): WorkoutSession {
  return { id: item.id, workoutId: item.workout_id, startedAt: new Date(item.started_at),
    finishedAt: item.finished_at ? new Date(item.finished_at) : null, duration: item.duration,
    exercises: reviveSessionExercises(item.exercises), totalVolume: item.total_volume, xpEarned: item.xp_earned,
    notes: item.notes, updatedAt: new Date(item.updated_at) }
}
function fromCloudMeasurement(item: CloudBodyMeasurement): BodyMeasurement {
  return { id: item.id, date: new Date(item.date), weight: item.weight, bodyFat: item.body_fat,
    leanMass: item.lean_mass, chest: item.chest, arm: item.arm, forearm: item.forearm, waist: item.waist,
    hip: item.hip, thigh: item.thigh, calf: item.calf, updatedAt: new Date(item.updated_at) }
}
function fromCloudCardio(item: CloudCardio): CardioSession {
  return { id: item.id, activity: item.activity as CardioSession['activity'], startedAt: new Date(item.started_at),
    duration: item.duration, distance: item.distance, calories: item.calories, avgHeartRate: item.avg_heart_rate,
    maxHeartRate: item.max_heart_rate, zones: item.zones, effort: item.effort,
    source: item.source === 'health' ? 'health' : 'manual', externalId: item.external_id, sourceName: item.source_name,
    notes: item.notes ?? '', updatedAt: new Date(item.updated_at) }
}
function fromCloudAchievement(item: CloudAchievement): AchievementRecord {
  return { id: item.id, unlockedAt: new Date(item.unlocked_at), updatedAt: new Date(item.updated_at) }
}

type PullMode = 'auto' | 'replace' | 'merge'
async function applyCloudSnapshot(snapshot: CloudSnapshot, mode: PullMode) {
  await db.transaction('rw', [db.workouts, db.exercises, db.sessions, db.measurements, db.profile,
    db.achievements, db.cardio, db.syncQueue, db.syncConflicts], async () => {
    if (mode === 'replace') {
      await db.syncQueue.clear()
      await db.syncConflicts.clear()
    }
    const pending = mode === 'replace' ? [] : await db.syncQueue.toArray()
    const conflicts = mode === 'replace' ? [] : await db.syncConflicts.toArray()
    const protectedKeys = new Set([...pending.map((item) => `${item.entity}:${item.entityId}`),
      ...conflicts.map((item) => `${item.entity}:${item.entityId}`)])
    const shouldReplace = mode === 'replace' || (mode === 'auto' && protectedKeys.size === 0)
    if (shouldReplace) await Promise.all([db.workouts.clear(), db.exercises.clear(), db.sessions.clear(),
      db.measurements.clear(), db.profile.clear(), db.achievements.clear(),
      // Keep local cardio when the cloud cannot store it yet.
      ...(snapshot.cardioAvailable ? [db.cardio.clear()] : [])])

    if (snapshot.profile && !protectedKeys.has('profile:profile')) await db.profile.put(fromCloudProfile(snapshot.profile))
    for (const item of snapshot.workouts) {
      if (protectedKeys.has(`workouts:${item.id}`)) continue
      if (item.deleted_at) await db.workouts.delete(item.id); else await db.workouts.put(fromCloudWorkout(item))
    }
    for (const item of snapshot.exercises) {
      if (protectedKeys.has(`exercises:${item.id}`)) continue
      if (item.deleted_at) await db.exercises.delete(item.id); else await db.exercises.put(fromCloudExercise(item))
    }
    for (const item of snapshot.sessions) {
      if (protectedKeys.has(`sessions:${item.id}`)) continue
      if (item.deleted_at) await db.sessions.delete(item.id); else await db.sessions.put(fromCloudSession(item))
    }
    for (const item of snapshot.measurements) {
      if (protectedKeys.has(`measurements:${item.id}`)) continue
      if (item.deleted_at) await db.measurements.delete(item.id); else await db.measurements.put(fromCloudMeasurement(item))
    }
    for (const item of snapshot.achievements) {
      if (protectedKeys.has(`achievements:${item.id}`)) continue
      if (item.deleted_at) await db.achievements.delete(item.id); else await db.achievements.put(fromCloudAchievement(item))
    }
    for (const item of snapshot.cardio) {
      if (protectedKeys.has(`cardio:${item.id}`)) continue
      if (item.deleted_at) await db.cardio.delete(item.id); else await db.cardio.put(fromCloudCardio(item))
    }
  })
}

async function reconcileLocalAggregates() {
  const [profile, sessions] = await Promise.all([getProfile(), db.sessions.toArray()])
  const reconciled = reconcileProfile(profile, sessions)
  const changed = profile.totalVolume !== reconciled.totalVolume || profile.totalWorkouts !== reconciled.totalWorkouts ||
    profile.xp !== reconciled.xp || profile.level !== reconciled.level || profile.streak !== reconciled.streak ||
    profile.longestStreak !== reconciled.longestStreak ||
    (profile.lastWorkoutDate?.getTime() ?? 0) !== (reconciled.lastWorkoutDate?.getTime() ?? 0)
  if (changed) {
    await db.profile.put(reconciled)
    await queueSync('profile', 'profile')
  }
}

async function emitSyncStatus(phase: SyncPhase, message: string | null = null): Promise<SyncOverview> {
  const [pending, conflicts] = await Promise.all([db.syncQueue.count(), db.syncConflicts.count()])
  const detail: SyncOverview = { phase, pending, conflicts, lastSyncedAt, message }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<SyncOverview>('workoutpro:sync-status', { detail }))
  return detail
}

export async function getSyncOverview(): Promise<SyncOverview> {
  lastSyncedAt = storedLastSync() ?? lastSyncedAt
  return emitSyncStatus(await db.syncConflicts.count() > 0 ? 'conflict' : 'idle')
}

export async function getSyncConflicts(): Promise<SyncConflict[]> {
  return db.syncConflicts.orderBy('detectedAt').reverse().toArray()
}

export async function syncLocalDataToSupabase(): Promise<{ uploaded: number; conflicts: number }> {
  const client = requireSupabase()
  const userId = await getCurrentUserId(client)
  const queue = await db.syncQueue.orderBy('createdAt').toArray()
  const byEntity = new Map<SyncEntity, SyncQueueItem[]>()
  for (const item of queue) byEntity.set(item.entity, [...(byEntity.get(item.entity) ?? []), item])
  let uploaded = 0
  let conflicts = 0
  for (const entity of ENTITY_ORDER) {
    const items = byEntity.get(entity)
    if (!items?.length) continue
    let result: BatchResult
    try {
      result = await uploadEntityBatch(client, userId, entity, items)
    } catch (error) {
      // Cardio waits in the queue until the cloud schema has its table.
      if (entity === 'cardio' && isMissingTable(error)) continue
      throw error
    }
    uploaded += result.uploaded
    conflicts += result.conflicts
  }
  return { uploaded, conflicts }
}

export async function restoreSupabaseDataToLocal(mode: PullMode = 'replace') {
  const client = requireSupabase()
  const userId = await getCurrentUserId(client)
  const snapshot = await fetchCloudSnapshot(client, userId)
  if (snapshotIsEmpty(snapshot)) throw new Error('Nenhum dado encontrado na nuvem')
  await applyCloudSnapshot(snapshot, mode)
  await reconcileLocalAggregates()
  writeCursor(userId, snapshotCursor(snapshot, readCursor(userId)))
  return {
    workouts: snapshot.workouts.filter((item) => !item.deleted_at).length,
    exercises: snapshot.exercises.filter((item) => !item.deleted_at).length,
    sessions: snapshot.sessions.filter((item) => !item.deleted_at).length,
    measurements: snapshot.measurements.filter((item) => !item.deleted_at).length,
    achievements: snapshot.achievements.filter((item) => !item.deleted_at).length,
  }
}

async function executeAutomaticSync(): Promise<SyncResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await emitSyncStatus('offline', 'Sem conexao. As alteracoes continuam salvas neste aparelho.')
    throw new Error('Dispositivo offline')
  }
  await emitSyncStatus('syncing')
  const client = requireSupabase()
  const userId = await getCurrentUserId(client)
  const cursor = readCursor(userId)
  let uploaded = 0
  let conflictCount = 0
  const firstPush = await syncLocalDataToSupabase()
  uploaded += firstPush.uploaded
  conflictCount += firstPush.conflicts

  // First sync on this device: full snapshot, and 'auto' may replace demo/local-only data.
  // Afterwards only rows changed since the cursor are pulled and merged (soft deletes included).
  const since = cursor ? new Date(new Date(cursor).getTime() - CURSOR_OVERLAP_MS).toISOString() : null
  let snapshot = await fetchCloudSnapshot(client, userId, since)
  if (!cursor && snapshotIsEmpty(snapshot)) {
    await queueFullSync()
    const initialPush = await syncLocalDataToSupabase()
    uploaded += initialPush.uploaded
    conflictCount += initialPush.conflicts
    snapshot = await fetchCloudSnapshot(client, userId)
  }
  if (!snapshotIsEmpty(snapshot)) {
    await applyCloudSnapshot(snapshot, cursor ? 'merge' : 'auto')
    await reconcileLocalAggregates()
  }
  if (await db.syncConflicts.count() === 0 && await db.syncQueue.count() > 0) {
    const finalPush = await syncLocalDataToSupabase()
    uploaded += finalPush.uploaded
    conflictCount += finalPush.conflicts
  }
  // An empty cloud on first sync still records a cursor (epoch) so later syncs are incremental.
  writeCursor(userId, snapshotCursor(snapshot, cursor) ?? new Date(0).toISOString())
  lastSyncedAt = new Date()
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LAST_SYNC_KEY, lastSyncedAt.toISOString())
    } catch {
      // ignore
    }
  }
  const result: SyncResult = {
    uploaded, conflicts: await db.syncConflicts.count(),
    workouts: snapshot.workouts.filter((item) => !item.deleted_at).length,
    exercises: snapshot.exercises.filter((item) => !item.deleted_at).length,
    sessions: snapshot.sessions.filter((item) => !item.deleted_at).length,
    measurements: snapshot.measurements.filter((item) => !item.deleted_at).length,
    achievements: snapshot.achievements.filter((item) => !item.deleted_at).length,
    pulled: snapshotRowCount(snapshot),
  }
  await emitSyncStatus(result.conflicts > 0 || conflictCount > 0 ? 'conflict' : 'synced')
  return result
}

export function runAutomaticSync(): Promise<SyncResult> {
  if (runningSync) return runningSync
  runningSync = executeAutomaticSync().catch(async (error) => {
    const offline = typeof navigator !== 'undefined' && !navigator.onLine
    if (!offline) await emitSyncStatus('error', error instanceof Error ? error.message : 'Falha ao sincronizar')
    reportError('automatic-sync', error, { offline })
    throw error
  }).finally(() => { runningSync = null })
  return runningSync
}

async function touchLocalEntity(entity: SyncEntity, entityId: string, updatedAt: Date) {
  if (entity === 'profile') return db.profile.update('profile', { updatedAt })
  if (entity === 'workouts') return db.workouts.update(entityId, { updatedAt })
  if (entity === 'exercises') return db.exercises.update(entityId, { updatedAt })
  if (entity === 'sessions') return db.sessions.update(entityId, { updatedAt })
  if (entity === 'measurements') return db.measurements.update(entityId, { updatedAt })
  if (entity === 'cardio') return db.cardio.update(entityId, { updatedAt })
  return db.achievements.update(entityId, { updatedAt })
}

async function applyConflictResolution(conflict: SyncConflict, strategy: 'local' | 'cloud') {
  if (strategy === 'local') {
    if (conflict.operation === 'upsert') await touchLocalEntity(conflict.entity, conflict.entityId, new Date())
    await db.syncConflicts.delete(conflict.id)
    await queueSync(conflict.entity, conflict.entityId, conflict.operation)
    return
  }

  await db.transaction('rw', [db.syncQueue, db.syncConflicts], async () => {
    const queued = await db.syncQueue.where('[entity+entityId]').equals([conflict.entity, conflict.entityId]).toArray()
    await db.syncQueue.bulkDelete(queued.map((item) => item.id))
    await db.syncConflicts.delete(conflict.id)
  })
}

export async function resolveConflict(conflictId: string, strategy: 'local' | 'cloud') {
  const conflict = await db.syncConflicts.get(conflictId)
  if (!conflict) return getSyncOverview()
  await applyConflictResolution(conflict, strategy)
  if (strategy === 'cloud') await restoreSupabaseDataToLocal('merge')
  return runAutomaticSync()
}

export async function resolveAllConflicts(strategy: 'local' | 'cloud') {
  const conflicts = await db.syncConflicts.toArray()
  for (const conflict of conflicts) await applyConflictResolution(conflict, strategy)
  if (strategy === 'cloud') await restoreSupabaseDataToLocal('merge')
  return runAutomaticSync()
}
