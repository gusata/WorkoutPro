import type { Exercise, UserProfile, Workout, WorkoutSession } from '@/types'

export function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  const now = new Date('2026-08-19T12:00:00-03:00')
  return {
    id: 'profile',
    name: 'Atleta',
    level: 1,
    xp: 0,
    totalVolume: 0,
    totalWorkouts: 0,
    streak: 0,
    longestStreak: 0,
    lastWorkoutDate: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  const now = new Date('2026-08-19T12:00:00-03:00')
  return {
    id: 'exercise-1',
    name: 'Supino',
    muscleGroup: 'Peitoral',
    notes: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  const now = new Date('2026-08-19T12:00:00-03:00')
  return {
    id: 'workout-1',
    name: 'Treino A',
    color: '#00c896',
    icon: 'dumbbell',
    exerciseIds: ['exercise-1'],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function makeSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  const startedAt = new Date('2026-08-19T12:00:00-03:00')
  const finishedAt = new Date('2026-08-19T13:00:00-03:00')
  return {
    id: 'session-1',
    workoutId: 'workout-1',
    startedAt,
    finishedAt,
    duration: 3600,
    exercises: [],
    totalVolume: 1000,
    xpEarned: 70,
    notes: '',
    updatedAt: finishedAt,
    ...overrides,
  }
}
