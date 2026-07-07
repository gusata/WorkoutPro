export type MuscleGroup =
  | 'Peitoral'
  | 'Costas'
  | 'Ombros'
  | 'Bíceps'
  | 'Tríceps'
  | 'Antebraço'
  | 'Abdômen'
  | 'Quadríceps'
  | 'Posterior'
  | 'Glúteo'
  | 'Panturrilha'
  | 'Trapézio'
  | 'Lombar'
  | 'Full Body'

export interface Workout {
  id: string
  name: string
  color: string
  icon: string
  exerciseIds: string[]
  createdAt: Date
  updatedAt: Date
}

export interface Exercise {
  id: string
  name: string
  muscleGroup: MuscleGroup
  notes: string
  createdAt: Date
}

export interface CompletedSet {
  id: string
  weight: number
  reps: number
  rpe: number | null
  completedAt: Date
}

export interface SessionExercise {
  exerciseId: string
  sets: CompletedSet[]
}

export interface WorkoutSession {
  id: string
  workoutId: string
  startedAt: Date
  finishedAt: Date | null
  duration: number
  exercises: SessionExercise[]
  totalVolume: number
  xpEarned: number
  notes: string
}

export interface BodyMeasurement {
  id: string
  date: Date
  weight: number | null
  bodyFat: number | null
  leanMass: number | null
  chest: number | null
  arm: number | null
  forearm: number | null
  waist: number | null
  hip: number | null
  thigh: number | null
  calf: number | null
}

export interface UserProfile {
  id: string
  name: string
  level: number
  xp: number
  totalVolume: number
  totalWorkouts: number
  streak: number
  longestStreak: number
  lastWorkoutDate: Date | null
  createdAt: Date
}

export interface AchievementRecord {
  id: string
  unlockedAt: Date
}

export interface AchievementDef {
  id: string
  title: string
  description: string
  icon: string
  color: string
  condition: (profile: UserProfile, sessions: WorkoutSession[]) => boolean
}

export interface ActiveSession {
  workoutId: string
  workoutName: string
  workoutColor: string
  startedAt: Date
  exercises: ActiveExercise[]
  notes: string
}

export interface ActiveExercise {
  exerciseId: string
  exerciseName: string
  muscleGroup: string
  notes?: string
  sets: ActiveSet[]
  restSeconds: number
}

export interface ActiveSet {
  id: string
  weight: number
  reps: number
  rpe: number | null
  completed: boolean
  completedAt: Date | null
}
