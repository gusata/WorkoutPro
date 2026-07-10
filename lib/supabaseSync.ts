'use client'

import { db, getProfile } from '@/lib/db'
import { supabase } from '@/lib/supabaseClient'
import type {
  AchievementRecord,
  BodyMeasurement,
  Exercise,
  MuscleGroup,
  SessionExercise,
  UserProfile,
  Workout,
  WorkoutSession,
} from '@/types'

interface CloudProfile {
  name: string
  level: number
  xp: number
  total_volume: number
  total_workouts: number
  streak: number
  longest_streak: number
  last_workout_date: string | null
  created_at: string
}

interface CloudWorkout {
  id: string
  name: string
  color: string
  icon: string
  exercise_ids: string[]
  created_at: string
  updated_at: string
}

interface CloudExercise {
  id: string
  name: string
  muscle_group: string
  notes: string
  created_at: string
}

interface CloudWorkoutSession {
  id: string
  workout_id: string
  started_at: string
  finished_at: string | null
  duration: number
  exercises: SessionExercise[]
  total_volume: number
  xp_earned: number
  notes: string
}

interface CloudBodyMeasurement {
  id: string
  date: string
  weight: number | null
  body_fat: number | null
  lean_mass: number | null
  chest: number | null
  arm: number | null
  forearm: number | null
  waist: number | null
  hip: number | null
  thigh: number | null
  calf: number | null
}

interface CloudAchievement {
  id: string
  unlocked_at: string
}

function isoDate(value: Date | string | null | undefined) {
  if (!value) return null
  return new Date(value).toISOString()
}

function serializeSessionExercises(exercises: unknown) {
  return JSON.parse(JSON.stringify(exercises, (_key, value) => {
    if (value instanceof Date) return value.toISOString()
    return value
  }))
}

async function getCurrentUserId() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError

  const userId = sessionData.session?.user.id
  if (!userId) {
    throw new Error('No Supabase user session')
  }

  return userId
}

function reviveSessionExercises(exercises: SessionExercise[] | null): SessionExercise[] {
  return (exercises ?? []).map((exercise) => ({
    exerciseId: exercise.exerciseId,
    sets: exercise.sets.map((set) => ({
      ...set,
      completedAt: new Date(set.completedAt),
    })),
  }))
}

async function applyQueuedDeletes(userId: string) {
  const deletes = await db.syncQueue.where('operation').equals('delete').toArray()
  const deletedAt = new Date().toISOString()

  for (const item of deletes) {
    if (item.entity === 'workouts') {
      const { error } = await supabase
        .from('workouts')
        .update({ deleted_at: deletedAt, updated_at: deletedAt })
        .eq('user_id', userId)
        .eq('id', item.entityId)
      if (error) throw error
    }

    if (item.entity === 'exercises') {
      const { error } = await supabase
        .from('exercises')
        .update({ deleted_at: deletedAt, updated_at: deletedAt })
        .eq('user_id', userId)
        .eq('id', item.entityId)
      if (error) throw error
    }

    if (item.entity === 'sessions') {
      const { error } = await supabase
        .from('workout_sessions')
        .update({ deleted_at: deletedAt, updated_at: deletedAt })
        .eq('user_id', userId)
        .eq('id', item.entityId)
      if (error) throw error
    }

    if (item.entity === 'measurements') {
      const { error } = await supabase
        .from('body_measurements')
        .update({ deleted_at: deletedAt, updated_at: deletedAt })
        .eq('user_id', userId)
        .eq('id', item.entityId)
      if (error) throw error
    }

    if (item.entity === 'achievements') {
      const { error } = await supabase
        .from('achievements')
        .delete()
        .eq('user_id', userId)
        .eq('id', item.entityId)
      if (error) throw error
    }
  }
}

export async function syncLocalDataToSupabase() {
  const userId = await getCurrentUserId()
  await applyQueuedDeletes(userId)

  const [profile, workouts, exercises, sessions, measurements, achievements] = await Promise.all([
    getProfile(),
    db.workouts.toArray(),
    db.exercises.toArray(),
    db.sessions.toArray(),
    db.measurements.toArray(),
    db.achievements.toArray(),
  ])

  const profilePayload = {
    id: userId,
    name: profile.name,
    level: profile.level,
    xp: profile.xp,
    total_volume: profile.totalVolume,
    total_workouts: profile.totalWorkouts,
    streak: profile.streak,
    longest_streak: profile.longestStreak,
    last_workout_date: isoDate(profile.lastWorkoutDate),
    created_at: isoDate(profile.createdAt),
  }

  const workoutPayload = workouts.map((workout) => ({
    id: workout.id,
    user_id: userId,
    name: workout.name,
    color: workout.color,
    icon: workout.icon,
    exercise_ids: workout.exerciseIds,
    created_at: isoDate(workout.createdAt),
    updated_at: isoDate(workout.updatedAt),
  }))

  const exercisePayload = exercises.map((exercise) => ({
    id: exercise.id,
    user_id: userId,
    name: exercise.name,
    muscle_group: exercise.muscleGroup,
    notes: exercise.notes,
    created_at: isoDate(exercise.createdAt),
    updated_at: new Date().toISOString(),
  }))

  const sessionPayload = sessions.map((session) => ({
    id: session.id,
    user_id: userId,
    workout_id: session.workoutId,
    started_at: isoDate(session.startedAt),
    finished_at: isoDate(session.finishedAt),
    duration: session.duration,
    exercises: serializeSessionExercises(session.exercises),
    total_volume: session.totalVolume,
    xp_earned: session.xpEarned,
    notes: session.notes,
  }))

  const measurementPayload = measurements.map((measurement) => ({
    id: measurement.id,
    user_id: userId,
    date: isoDate(measurement.date),
    weight: measurement.weight,
    body_fat: measurement.bodyFat,
    lean_mass: measurement.leanMass,
    chest: measurement.chest,
    arm: measurement.arm,
    forearm: measurement.forearm,
    waist: measurement.waist,
    hip: measurement.hip,
    thigh: measurement.thigh,
    calf: measurement.calf,
  }))

  const achievementPayload = achievements.map((achievement) => ({
    id: achievement.id,
    user_id: userId,
    unlocked_at: isoDate(achievement.unlockedAt),
  }))

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(profilePayload, { onConflict: 'id' })
  if (profileError) throw profileError

  if (workoutPayload.length > 0) {
    const { error } = await supabase
      .from('workouts')
      .upsert(workoutPayload, { onConflict: 'user_id,id' })
    if (error) throw error
  }

  if (exercisePayload.length > 0) {
    const { error } = await supabase
      .from('exercises')
      .upsert(exercisePayload, { onConflict: 'user_id,id' })
    if (error) throw error
  }

  if (sessionPayload.length > 0) {
    const { error } = await supabase
      .from('workout_sessions')
      .upsert(sessionPayload, { onConflict: 'user_id,id' })
    if (error) throw error
  }

  if (measurementPayload.length > 0) {
    const { error } = await supabase
      .from('body_measurements')
      .upsert(measurementPayload, { onConflict: 'user_id,id' })
    if (error) throw error
  }

  if (achievementPayload.length > 0) {
    const { error } = await supabase
      .from('achievements')
      .upsert(achievementPayload, { onConflict: 'user_id,id' })
    if (error) throw error
  }

  await db.syncQueue.clear()

  return {
    workouts: workoutPayload.length,
    exercises: exercisePayload.length,
    sessions: sessionPayload.length,
    measurements: measurementPayload.length,
    achievements: achievementPayload.length,
  }
}

export async function restoreSupabaseDataToLocal() {
  const userId = await getCurrentUserId()

  const [
    profileResult,
    workoutsResult,
    exercisesResult,
    sessionsResult,
    measurementsResult,
    achievementsResult,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle<CloudProfile>(),
    supabase.from('workouts').select('*').eq('user_id', userId).is('deleted_at', null),
    supabase.from('exercises').select('*').eq('user_id', userId).is('deleted_at', null),
    supabase.from('workout_sessions').select('*').eq('user_id', userId).is('deleted_at', null),
    supabase.from('body_measurements').select('*').eq('user_id', userId).is('deleted_at', null),
    supabase.from('achievements').select('*').eq('user_id', userId),
  ])

  if (profileResult.error) throw profileResult.error
  if (workoutsResult.error) throw workoutsResult.error
  if (exercisesResult.error) throw exercisesResult.error
  if (sessionsResult.error) throw sessionsResult.error
  if (measurementsResult.error) throw measurementsResult.error
  if (achievementsResult.error) throw achievementsResult.error

  const cloudProfile = profileResult.data
  const cloudWorkouts = (workoutsResult.data ?? []) as CloudWorkout[]
  const cloudExercises = (exercisesResult.data ?? []) as CloudExercise[]
  const cloudSessions = (sessionsResult.data ?? []) as CloudWorkoutSession[]
  const cloudMeasurements = (measurementsResult.data ?? []) as CloudBodyMeasurement[]
  const cloudAchievements = (achievementsResult.data ?? []) as CloudAchievement[]

  const totalCloudItems =
    cloudWorkouts.length +
    cloudExercises.length +
    cloudSessions.length +
    cloudMeasurements.length +
    cloudAchievements.length

  if (!cloudProfile && totalCloudItems === 0) {
    throw new Error('No cloud data found')
  }

  const restoredProfile: UserProfile = {
    id: 'profile',
    name: cloudProfile?.name ?? 'Atleta',
    level: cloudProfile?.level ?? 1,
    xp: cloudProfile?.xp ?? 0,
    totalVolume: cloudProfile?.total_volume ?? 0,
    totalWorkouts: cloudProfile?.total_workouts ?? 0,
    streak: cloudProfile?.streak ?? 0,
    longestStreak: cloudProfile?.longest_streak ?? 0,
    lastWorkoutDate: cloudProfile?.last_workout_date
      ? new Date(cloudProfile.last_workout_date)
      : null,
    createdAt: cloudProfile?.created_at ? new Date(cloudProfile.created_at) : new Date(),
  }

  const restoredWorkouts: Workout[] = cloudWorkouts.map((workout) => ({
    id: workout.id,
    name: workout.name,
    color: workout.color,
    icon: workout.icon,
    exerciseIds: workout.exercise_ids,
    createdAt: new Date(workout.created_at),
    updatedAt: new Date(workout.updated_at),
  }))

  const restoredExercises: Exercise[] = cloudExercises.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    muscleGroup: exercise.muscle_group as MuscleGroup,
    notes: exercise.notes,
    createdAt: new Date(exercise.created_at),
  }))

  const restoredSessions: WorkoutSession[] = cloudSessions.map((session) => ({
    id: session.id,
    workoutId: session.workout_id,
    startedAt: new Date(session.started_at),
    finishedAt: session.finished_at ? new Date(session.finished_at) : null,
    duration: session.duration,
    exercises: reviveSessionExercises(session.exercises),
    totalVolume: session.total_volume,
    xpEarned: session.xp_earned,
    notes: session.notes,
  }))

  const restoredMeasurements: BodyMeasurement[] = cloudMeasurements.map((measurement) => ({
    id: measurement.id,
    date: new Date(measurement.date),
    weight: measurement.weight,
    bodyFat: measurement.body_fat,
    leanMass: measurement.lean_mass,
    chest: measurement.chest,
    arm: measurement.arm,
    forearm: measurement.forearm,
    waist: measurement.waist,
    hip: measurement.hip,
    thigh: measurement.thigh,
    calf: measurement.calf,
  }))

  const restoredAchievements: AchievementRecord[] = cloudAchievements.map((achievement) => ({
    id: achievement.id,
    unlockedAt: new Date(achievement.unlocked_at),
  }))

  await db.transaction('rw', [db.workouts, db.exercises, db.sessions, db.measurements, db.profile, db.achievements, db.syncQueue], async () => {
    await db.workouts.clear()
    await db.exercises.clear()
    await db.sessions.clear()
    await db.measurements.clear()
    await db.profile.clear()
    await db.achievements.clear()
    await db.syncQueue.clear()

    await db.profile.add(restoredProfile)
    if (restoredWorkouts.length > 0) await db.workouts.bulkAdd(restoredWorkouts)
    if (restoredExercises.length > 0) await db.exercises.bulkAdd(restoredExercises)
    if (restoredSessions.length > 0) await db.sessions.bulkAdd(restoredSessions)
    if (restoredMeasurements.length > 0) await db.measurements.bulkAdd(restoredMeasurements)
    if (restoredAchievements.length > 0) await db.achievements.bulkAdd(restoredAchievements)
  })

  return {
    workouts: restoredWorkouts.length,
    exercises: restoredExercises.length,
    sessions: restoredSessions.length,
    measurements: restoredMeasurements.length,
    achievements: restoredAchievements.length,
  }
}

export async function runAutomaticSync() {
  const pending = await db.syncQueue.count()
  let uploaded = false

  if (pending > 0) {
    await syncLocalDataToSupabase()
    uploaded = true
  }

  const restored = await restoreSupabaseDataToLocal()

  return {
    uploaded,
    ...restored,
  }
}
