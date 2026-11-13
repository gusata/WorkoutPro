import Dexie, { type EntityTable } from 'dexie'
import type {
  Workout,
  Exercise,
  WorkoutSession,
  BodyMeasurement,
  UserProfile,
  AchievementRecord,
  CardioSession,
  MediaItem,
  SyncQueueItem,
  SyncConflict,
} from '@/types'
import { clearSyncCursors } from '@/lib/syncCursor'

class WorkoutDatabase extends Dexie {
  workouts!: EntityTable<Workout, 'id'>
  exercises!: EntityTable<Exercise, 'id'>
  sessions!: EntityTable<WorkoutSession, 'id'>
  measurements!: EntityTable<BodyMeasurement, 'id'>
  profile!: EntityTable<UserProfile, 'id'>
  achievements!: EntityTable<AchievementRecord, 'id'>
  syncQueue!: EntityTable<SyncQueueItem, 'id'>
  syncConflicts!: EntityTable<SyncConflict, 'id'>
  media!: EntityTable<MediaItem, 'id'>
  cardio!: EntityTable<CardioSession, 'id'>

  constructor() {
    super('WorkoutProDB')
    this.version(1).stores({
      workouts: 'id, name, createdAt',
      exercises: 'id, name, muscleGroup, createdAt',
      sessions: 'id, workoutId, startedAt, finishedAt',
      measurements: 'id, date',
      profile: 'id',
      achievements: 'id, unlockedAt',
    })
    this.version(2).stores({
      workouts: 'id, name, createdAt',
      exercises: 'id, name, muscleGroup, createdAt',
      sessions: 'id, workoutId, startedAt, finishedAt',
      measurements: 'id, date',
      profile: 'id',
      achievements: 'id, unlockedAt',
      syncQueue: 'id, entity, entityId, [entity+entityId], operation, createdAt',
    })
    this.version(3).stores({
      workouts: 'id, name, createdAt',
      exercises: 'id, name, muscleGroup, createdAt',
      sessions: 'id, workoutId, startedAt, finishedAt',
      measurements: 'id, date',
      profile: 'id',
      achievements: 'id, unlockedAt',
      syncQueue: 'id, entity, entityId, [entity+entityId], operation, createdAt',
      syncConflicts: 'id, entity, entityId, [entity+entityId], detectedAt',
    }).upgrade(async (transaction) => {
      const now = new Date()
      await transaction.table('workouts').toCollection().modify((item) => {
        item.updatedAt = item.updatedAt ? new Date(item.updatedAt) : new Date(item.createdAt ?? now)
      })
      await transaction.table('exercises').toCollection().modify((item) => {
        item.updatedAt = item.updatedAt ? new Date(item.updatedAt) : new Date(item.createdAt ?? now)
      })
      await transaction.table('sessions').toCollection().modify((item) => {
        item.updatedAt = item.updatedAt ? new Date(item.updatedAt) : new Date(item.finishedAt ?? item.startedAt ?? now)
      })
      await transaction.table('measurements').toCollection().modify((item) => {
        item.updatedAt = item.updatedAt ? new Date(item.updatedAt) : new Date(item.date ?? now)
      })
      await transaction.table('profile').toCollection().modify((item) => {
        item.updatedAt = item.updatedAt ? new Date(item.updatedAt) : new Date(item.createdAt ?? now)
      })
      await transaction.table('achievements').toCollection().modify((item) => {
        item.updatedAt = item.updatedAt ? new Date(item.updatedAt) : new Date(item.unlockedAt ?? now)
      })
      await transaction.table('syncQueue').toCollection().modify((item) => {
        item.lastError = item.lastError ?? null
      })
    })
    // Local-only media (technique videos, progress photos). Not part of sync or backups.
    this.version(4).stores({
      media: 'id, kind, sessionId, exerciseId, createdAt',
    })
    this.version(5).stores({
      cardio: 'id, startedAt, activity, externalId',
    })
  }
}

export const db = new WorkoutDatabase()

export async function initProfile() {
  const existing = await db.profile.get('profile')
  if (!existing) {
    await db.profile.add({
      id: 'profile',
      name: 'Atleta',
      level: 1,
      xp: 0,
      totalVolume: 0,
      totalWorkouts: 0,
      streak: 0,
      longestStreak: 0,
      lastWorkoutDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }
}

export async function getProfile(): Promise<UserProfile> {
  await initProfile()
  return (await db.profile.get('profile'))!
}

export async function clearLocalData() {
  await db.transaction('rw', [db.workouts, db.exercises, db.sessions, db.measurements, db.profile, db.achievements, db.syncQueue, db.syncConflicts, db.media, db.cardio], async () => {
    await db.workouts.clear()
    await db.exercises.clear()
    await db.sessions.clear()
    await db.measurements.clear()
    await db.profile.clear()
    await db.achievements.clear()
    await db.syncQueue.clear()
    await db.syncConflicts.clear()
    await db.media.clear()
    await db.cardio.clear()
  })
  // Local data is gone, so the next cloud sync must be a full one again.
  clearSyncCursors()
}
