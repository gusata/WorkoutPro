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
  exerciseConfigs?: WorkoutExerciseConfig[]
  scheduledWeekdays?: number[]
  createdAt: Date
  updatedAt: Date
}

export type SetType = 'warmup' | 'normal' | 'drop' | 'failure' | 'amrap'

export interface ProgressionRule {
  type: 'double-progression'
  increment: number
  minimumRir: number
}

export interface WorkoutExerciseConfig {
  exerciseId: string
  targetSets: number
  minReps: number
  maxReps: number
  restSeconds: number
  supersetId?: string | null
  progression?: ProgressionRule
}

export interface Exercise {
  id: string
  name: string
  muscleGroup: MuscleGroup
  notes: string
  equipment?: string
  machineSettings?: string
  alternatives?: string[]
  createdAt: Date
  updatedAt: Date
}

export interface CompletedSet {
  id: string
  weight: number
  reps: number
  rpe: number | null
  rir?: number | null
  setType?: SetType
  /** Local media id (IndexedDB) of a technique video recorded for this set. */
  videoId?: string | null
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
  updatedAt: Date
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
  updatedAt: Date
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
  availableEquipment?: string[]
  preferences?: UserPreferences
  trainingBlock?: TrainingBlock | null
  lastWorkoutDate: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface WeeklyGoals {
  workouts: number
  minutes: number
  sets: number
  /** Weekly cardio minutes (WHO recommends 150 moderate). */
  cardioMinutes?: number
}

export interface ReminderPreferences {
  enabled: boolean
  /** Minutes after midnight; null = learn from the usual training time. */
  timeOfDay: number | null
}

export interface UserPreferences {
  weeklyGoals?: WeeklyGoals
  reminders?: ReminderPreferences
  /** Mirror weight/body fat to Apple Health / Health Connect. */
  healthSync?: boolean
  barWeight?: number
  /** Used to estimate the maximum heart rate for training zones. */
  birthYear?: number | null
  /** Measured maximum heart rate; overrides the age-based estimate. */
  maxHeartRate?: number | null
  /** Heart rate under which a rest counts as recovered; default from resting / max HR. */
  recoveryHeartRate?: number | null
  /** Weekly hard-set target range per muscle; missing muscles use the defaults. */
  muscleTargets?: Partial<Record<MuscleGroup, MuscleTargetRange>>
}

/** Weekly hard working sets considered productive for a muscle. */
export interface MuscleTargetRange {
  min: number
  max: number
}

export type CardioActivity =
  | 'running' | 'walking' | 'cycling' | 'treadmill' | 'elliptical' | 'rowing'
  | 'stairs' | 'swimming' | 'hiit' | 'hiking' | 'other'

/** A cardio workout, logged by hand or imported from Health Connect / Apple Health. */
export interface CardioSession {
  id: string
  activity: CardioActivity
  startedAt: Date
  /** Seconds. */
  duration: number
  /** Meters. */
  distance: number | null
  calories: number | null
  avgHeartRate: number | null
  maxHeartRate: number | null
  /** Seconds spent in heart-rate zones 1..5, when known. */
  zones?: number[] | null
  /** Perceived effort 1..10 (manual entries). */
  effort: number | null
  source: 'manual' | 'health'
  /** Id in the health store, to avoid importing the same workout twice. */
  externalId?: string | null
  sourceName?: string | null
  notes: string
  updatedAt: Date
}

/** A periodized training block (mesocycle) with a weekly set target that ramps up. */
export interface TrainingBlock {
  id: string
  name: string
  startDate: Date
  weeks: number
  /** Weekly hard sets in week 1. */
  baseWeeklySets: number
  /** Percent added to the weekly set target each week. */
  weeklyIncreasePct: number
  /** Last week is a deload at ~50% of the base volume. */
  deloadLastWeek: boolean
}

export type MediaKind = 'video' | 'photo'

/** Large binary files kept only on this device (never synced or put in backups). */
export interface MediaItem {
  id: string
  kind: MediaKind
  blob: Blob
  mimeType: string
  createdAt: Date
  sessionId?: string | null
  exerciseId?: string | null
  setId?: string | null
  note?: string
}

export interface AchievementRecord {
  id: string
  unlockedAt: Date
  updatedAt: Date
}

export type SyncEntity =
  | 'profile'
  | 'workouts'
  | 'exercises'
  | 'sessions'
  | 'measurements'
  | 'achievements'
  | 'cardio'

export interface SyncQueueItem {
  id: string
  entity: SyncEntity
  entityId: string
  operation: 'upsert' | 'delete'
  createdAt: Date
  attempts: number
  lastError: string | null
}

export interface SyncConflict {
  id: string
  entity: SyncEntity
  entityId: string
  operation: SyncQueueItem['operation']
  localUpdatedAt: Date
  remoteUpdatedAt: Date
  detectedAt: Date
  reason: string
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
  sessionId: string
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
  machineSettings?: string
  previousSets?: Array<Pick<CompletedSet, 'weight' | 'reps' | 'rpe' | 'rir' | 'setType'>>
  supersetId?: string | null
  targetMinReps?: number
  targetMaxReps?: number
  progression?: ProgressionRule
  sets: ActiveSet[]
  restSeconds: number
}

export interface ActiveSet {
  id: string
  weight: number
  reps: number
  rpe: number | null
  rir?: number | null
  setType?: SetType
  videoId?: string | null
  completed: boolean
  completedAt: Date | null
}
