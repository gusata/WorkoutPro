import Dexie, { type EntityTable } from 'dexie'
import type {
  Workout,
  Exercise,
  WorkoutSession,
  BodyMeasurement,
  UserProfile,
  AchievementRecord,
  SyncQueueItem,
} from '@/types'

class WorkoutDatabase extends Dexie {
  workouts!: EntityTable<Workout, 'id'>
  exercises!: EntityTable<Exercise, 'id'>
  sessions!: EntityTable<WorkoutSession, 'id'>
  measurements!: EntityTable<BodyMeasurement, 'id'>
  profile!: EntityTable<UserProfile, 'id'>
  achievements!: EntityTable<AchievementRecord, 'id'>
  syncQueue!: EntityTable<SyncQueueItem, 'id'>

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
    })
  }
}

export async function getProfile(): Promise<UserProfile> {
  await initProfile()
  return (await db.profile.get('profile'))!
}

export async function exportData() {
  const [workouts, exercises, sessions, measurements, profile, achievements] =
    await Promise.all([
      db.workouts.toArray(),
      db.exercises.toArray(),
      db.sessions.toArray(),
      db.measurements.toArray(),
      db.profile.toArray(),
      db.achievements.toArray(),
    ])
  return { workouts, exercises, sessions, measurements, profile, achievements, exportedAt: new Date().toISOString() }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function importData(data: any) {
  await db.transaction('rw', [db.workouts, db.exercises, db.sessions, db.measurements, db.profile, db.achievements, db.syncQueue], async () => {
    await db.workouts.clear()
    await db.exercises.clear()
    await db.sessions.clear()
    await db.measurements.clear()
    await db.profile.clear()
    await db.achievements.clear()
    await db.syncQueue.clear()
    if (data.workouts?.length) await db.workouts.bulkAdd(data.workouts)
    if (data.exercises?.length) await db.exercises.bulkAdd(data.exercises)
    if (data.sessions?.length) await db.sessions.bulkAdd(data.sessions)
    if (data.measurements?.length) await db.measurements.bulkAdd(data.measurements)
    if (data.profile?.length) await db.profile.bulkAdd(data.profile)
    if (data.achievements?.length) await db.achievements.bulkAdd(data.achievements)
  })
}

export async function clearLocalData() {
  await db.transaction('rw', [db.workouts, db.exercises, db.sessions, db.measurements, db.profile, db.achievements, db.syncQueue], async () => {
    await db.workouts.clear()
    await db.exercises.clear()
    await db.sessions.clear()
    await db.measurements.clear()
    await db.profile.clear()
    await db.achievements.clear()
    await db.syncQueue.clear()
  })
}
