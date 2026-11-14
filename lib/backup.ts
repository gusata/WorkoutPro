import { db } from '@/lib/db'
import { generateId, MUSCLE_GROUPS } from '@/lib/utils'
import { parseDiscomfort } from '@/lib/discomfort'
import type {
  AchievementRecord,
  BodyMeasurement,
  CardioActivity,
  CardioSession,
  CompletedSet,
  Exercise,
  MuscleGroup,
  SyncEntity,
  SyncQueueItem,
  TrainingBlock,
  UserPreferences,
  UserProfile,
  Workout,
  WorkoutSession,
} from '@/types'

export const BACKUP_SCHEMA_VERSION = 1

interface BackupData {
  workouts: Workout[]
  exercises: Exercise[]
  sessions: WorkoutSession[]
  measurements: BodyMeasurement[]
  profile: UserProfile[]
  achievements: AchievementRecord[]
  /** Added later; older backups don't have it. */
  cardio?: CardioSession[]
}

export interface WorkoutProBackup {
  app: 'WorkoutPro'
  schemaVersion: typeof BACKUP_SCHEMA_VERSION
  exportedAt: string
  data: BackupData
}

export interface BackupPreview {
  exportedAt: Date | null
  legacy: boolean
  workouts: number
  exercises: number
  sessions: number
  measurements: number
  achievements: number
  profileName: string
}

export interface ParsedBackup {
  backup: WorkoutProBackup
  preview: BackupPreview
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value)
}

function parseDate(value: unknown, field: string): Date {
  if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`Data invalida em ${field}`)
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`Data invalida em ${field}`)
  return date
}

function optionalDate(value: unknown, fallback: Date, field: string): Date {
  return value == null ? fallback : parseDate(value, field)
}

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Campo ${field} ausente ou invalido`)
  return value
}

function requireString(value: unknown, field: string): string {
  if (!isString(value)) throw new Error(`Campo ${field} ausente ou invalido`)
  return value
}

function requireNumber(value: unknown, field: string): number {
  if (!isFiniteNumber(value)) throw new Error(`Campo ${field} ausente ou invalido`)
  return value
}

function parseWorkout(value: unknown, index: number): Workout {
  if (!isRecord(value)) throw new Error(`Treino ${index + 1} invalido`)
  const createdAt = parseDate(value.createdAt, `workouts[${index}].createdAt`)
  const exerciseIds = requireArray(value.exerciseIds, `workouts[${index}].exerciseIds`)
  if (!exerciseIds.every(isString)) throw new Error(`IDs de exercicio invalidos no treino ${index + 1}`)
  const configs = Array.isArray(value.exerciseConfigs) ? value.exerciseConfigs.filter(isRecord).map((config) => ({
    exerciseId: requireString(config.exerciseId, `workouts[${index}].exerciseConfigs.exerciseId`),
    targetSets: isFiniteNumber(config.targetSets) ? config.targetSets : 3,
    minReps: isFiniteNumber(config.minReps) ? config.minReps : 8,
    maxReps: isFiniteNumber(config.maxReps) ? config.maxReps : 12,
    restSeconds: isFiniteNumber(config.restSeconds) ? config.restSeconds : 90,
    supersetId: isString(config.supersetId) ? config.supersetId : null,
    ...(isRecord(config.progression) && isFiniteNumber(config.progression.increment) ? {
      progression: {
        type: 'double-progression' as const,
        increment: config.progression.increment,
        minimumRir: isFiniteNumber(config.progression.minimumRir) ? config.progression.minimumRir : 1,
      },
    } : {}),
  })) : []
  return {
    id: requireString(value.id, `workouts[${index}].id`),
    name: requireString(value.name, `workouts[${index}].name`),
    color: requireString(value.color, `workouts[${index}].color`),
    icon: requireString(value.icon, `workouts[${index}].icon`),
    exerciseIds,
    exerciseConfigs: configs,
    scheduledWeekdays: Array.isArray(value.scheduledWeekdays) ? value.scheduledWeekdays.filter(isFiniteNumber) : [],
    createdAt,
    updatedAt: optionalDate(value.updatedAt, createdAt, `workouts[${index}].updatedAt`),
  }
}

function parseExercise(value: unknown, index: number): Exercise {
  if (!isRecord(value)) throw new Error(`Exercicio ${index + 1} invalido`)
  const createdAt = parseDate(value.createdAt, `exercises[${index}].createdAt`)
  const muscleGroup = requireString(value.muscleGroup, `exercises[${index}].muscleGroup`)
  if (!MUSCLE_GROUPS.includes(muscleGroup as MuscleGroup)) {
    throw new Error(`Grupo muscular invalido no exercicio ${index + 1}`)
  }
  return {
    id: requireString(value.id, `exercises[${index}].id`),
    name: requireString(value.name, `exercises[${index}].name`),
    muscleGroup: muscleGroup as MuscleGroup,
    notes: requireString(value.notes, `exercises[${index}].notes`),
    equipment: isString(value.equipment) ? value.equipment : undefined,
    machineSettings: isString(value.machineSettings) ? value.machineSettings : undefined,
    alternatives: Array.isArray(value.alternatives) ? value.alternatives.filter(isString) : [],
    libraryId: isString(value.libraryId) && value.libraryId ? value.libraryId : undefined,
    createdAt,
    updatedAt: optionalDate(value.updatedAt, createdAt, `exercises[${index}].updatedAt`),
  }
}

function parseCompletedSet(value: unknown, path: string): CompletedSet {
  if (!isRecord(value)) throw new Error(`Serie invalida em ${path}`)
  const rpe = value.rpe
  if (rpe !== null && !isFiniteNumber(rpe)) throw new Error(`RPE invalido em ${path}`)
  const rir = value.rir
  if (rir !== undefined && rir !== null && !isFiniteNumber(rir)) throw new Error(`RIR invalido em ${path}`)
  const allowedSetTypes = ['warmup', 'normal', 'drop', 'failure', 'amrap'] as const
  const setType = allowedSetTypes.find((item) => item === value.setType) ?? 'normal'
  return {
    id: requireString(value.id, `${path}.id`),
    weight: requireNumber(value.weight, `${path}.weight`),
    reps: requireNumber(value.reps, `${path}.reps`),
    rpe,
    rir: rir == null ? null : rir,
    setType,
    ...(isString(value.videoId) ? { videoId: value.videoId } : {}),
    completedAt: parseDate(value.completedAt, `${path}.completedAt`),
  }
}

function parseSession(value: unknown, index: number): WorkoutSession {
  if (!isRecord(value)) throw new Error(`Sessao ${index + 1} invalida`)
  const startedAt = parseDate(value.startedAt, `sessions[${index}].startedAt`)
  const finishedAt = value.finishedAt == null
    ? null
    : parseDate(value.finishedAt, `sessions[${index}].finishedAt`)
  const exercises = requireArray(value.exercises, `sessions[${index}].exercises`).map((exercise, exerciseIndex) => {
    if (!isRecord(exercise)) throw new Error(`Exercicio de sessao invalido em sessions[${index}]`)
    const discomfort = parseDiscomfort(exercise.discomfort)
    return {
      ...(discomfort ? { discomfort } : {}),
      exerciseId: requireString(exercise.exerciseId, `sessions[${index}].exercises[${exerciseIndex}].exerciseId`),
      sets: requireArray(exercise.sets, `sessions[${index}].exercises[${exerciseIndex}].sets`).map((set, setIndex) =>
        parseCompletedSet(set, `sessions[${index}].exercises[${exerciseIndex}].sets[${setIndex}]`)
      ),
    }
  })
  return {
    id: requireString(value.id, `sessions[${index}].id`),
    workoutId: requireString(value.workoutId, `sessions[${index}].workoutId`),
    startedAt,
    finishedAt,
    duration: requireNumber(value.duration, `sessions[${index}].duration`),
    exercises,
    totalVolume: requireNumber(value.totalVolume, `sessions[${index}].totalVolume`),
    xpEarned: requireNumber(value.xpEarned, `sessions[${index}].xpEarned`),
    notes: requireString(value.notes, `sessions[${index}].notes`),
    updatedAt: optionalDate(value.updatedAt, finishedAt ?? startedAt, `sessions[${index}].updatedAt`),
  }
}

const measurementKeys = [
  'weight', 'bodyFat', 'leanMass', 'chest', 'arm', 'forearm', 'waist', 'hip', 'thigh', 'calf',
] as const

function parseMeasurement(value: unknown, index: number): BodyMeasurement {
  if (!isRecord(value)) throw new Error(`Medida ${index + 1} invalida`)
  const date = parseDate(value.date, `measurements[${index}].date`)
  const parsed = {
    id: requireString(value.id, `measurements[${index}].id`),
    date,
    updatedAt: optionalDate(value.updatedAt, date, `measurements[${index}].updatedAt`),
  } as BodyMeasurement
  for (const key of measurementKeys) {
    const field = value[key] ?? null
    if (!isNullableNumber(field)) throw new Error(`Campo ${key} invalido na medida ${index + 1}`)
    parsed[key] = field
  }
  return parsed
}

function positive(value: unknown, fallback: number) {
  return isFiniteNumber(value) && value > 0 ? value : fallback
}

function parsePreferences(value: unknown): UserPreferences {
  if (!isRecord(value)) return {}
  const goals = isRecord(value.weeklyGoals) ? value.weeklyGoals : null
  const reminders = isRecord(value.reminders) ? value.reminders : null
  return {
    weeklyGoals: goals ? { workouts: positive(goals.workouts, 4), minutes: positive(goals.minutes, 180), sets: positive(goals.sets, 60) } : undefined,
    reminders: reminders ? { enabled: reminders.enabled === true, timeOfDay: isFiniteNumber(reminders.timeOfDay) ? reminders.timeOfDay : null } : undefined,
    healthSync: value.healthSync === true,
    barWeight: isFiniteNumber(value.barWeight) ? value.barWeight : undefined,
    birthYear: isFiniteNumber(value.birthYear) ? value.birthYear : undefined,
    maxHeartRate: isFiniteNumber(value.maxHeartRate) ? value.maxHeartRate : undefined,
    recoveryHeartRate: isFiniteNumber(value.recoveryHeartRate) ? value.recoveryHeartRate : undefined,
    muscleTargets: parseMuscleTargets(value.muscleTargets),
    ...(Array.isArray(value.autoWarmupExerciseIds) ? { autoWarmupExerciseIds: value.autoWarmupExerciseIds.filter(isString) } : {}),
    ...(Array.isArray(value.trainingBlockHistory) ? {
      trainingBlockHistory: value.trainingBlockHistory
        .map((block, index) => parseTrainingBlock(block, `profile.preferences.trainingBlockHistory[${index}]`))
        .filter((block): block is TrainingBlock => block !== null),
    } : {}),
  }
}

function parseMuscleTargets(value: unknown): UserPreferences['muscleTargets'] {
  if (!isRecord(value)) return undefined
  const result: NonNullable<UserPreferences['muscleTargets']> = {}
  for (const [muscle, range] of Object.entries(value)) {
    if (!(MUSCLE_GROUPS as readonly string[]).includes(muscle) || !isRecord(range) || !isFiniteNumber(range.min) || !isFiniteNumber(range.max) || range.min < 0 || range.max < range.min) continue
    result[muscle as keyof typeof result] = { min: range.min, max: range.max }
  }
  return result
}


const TRAINING_GOALS = ['hipertrofia', 'forca', 'condicionamento'] as const

function parseTrainingBlock(value: unknown, path = 'profile.trainingBlock'): TrainingBlock | null {
  if (!isRecord(value)) return null
  const goal = TRAINING_GOALS.find((item) => item === value.goal)
  return {
    id: requireString(value.id, `${path}.id`),
    name: requireString(value.name, `${path}.name`),
    startDate: parseDate(value.startDate, `${path}.startDate`),
    weeks: positive(value.weeks, 6),
    baseWeeklySets: positive(value.baseWeeklySets, 60),
    weeklyIncreasePct: isFiniteNumber(value.weeklyIncreasePct) ? value.weeklyIncreasePct : 10,
    deloadLastWeek: value.deloadLastWeek !== false,
    ...(goal ? { goal } : {}),
    ...(Array.isArray(value.workoutIds) ? { workoutIds: value.workoutIds.filter(isString) } : {}),
    ...(value.endedAt != null ? { endedAt: parseDate(value.endedAt, `${path}.endedAt`) } : {}),
  }
}

function parseProfile(value: unknown): UserProfile {
  if (!isRecord(value)) throw new Error('Perfil invalido')
  const createdAt = parseDate(value.createdAt, 'profile.createdAt')
  return {
    id: 'profile',
    name: requireString(value.name, 'profile.name'),
    level: requireNumber(value.level, 'profile.level'),
    xp: requireNumber(value.xp, 'profile.xp'),
    totalVolume: requireNumber(value.totalVolume, 'profile.totalVolume'),
    totalWorkouts: requireNumber(value.totalWorkouts, 'profile.totalWorkouts'),
    streak: requireNumber(value.streak, 'profile.streak'),
    longestStreak: requireNumber(value.longestStreak, 'profile.longestStreak'),
    availableEquipment: Array.isArray(value.availableEquipment) ? value.availableEquipment.filter(isString) : [],
    lastWorkoutDate: value.lastWorkoutDate == null ? null : parseDate(value.lastWorkoutDate, 'profile.lastWorkoutDate'),
    preferences: parsePreferences(value.preferences),
    trainingBlock: parseTrainingBlock(value.trainingBlock),
    createdAt,
    updatedAt: optionalDate(value.updatedAt, createdAt, 'profile.updatedAt'),
  }
}

const CARDIO_ACTIVITIES: CardioActivity[] = ['running', 'walking', 'cycling', 'treadmill', 'elliptical', 'rowing', 'stairs', 'swimming', 'hiit', 'hiking', 'other']

function nullableNumber(value: unknown) {
  return isFiniteNumber(value) ? value : null
}

function parseCardio(value: unknown, index: number): CardioSession {
  if (!isRecord(value)) throw new Error(`Cardio ${index + 1} invalido`)
  const startedAt = parseDate(value.startedAt, `cardio[${index}].startedAt`)
  const activity = CARDIO_ACTIVITIES.find((item) => item === value.activity) ?? 'other'
  return {
    id: requireString(value.id, `cardio[${index}].id`),
    activity,
    startedAt,
    duration: requireNumber(value.duration, `cardio[${index}].duration`),
    distance: nullableNumber(value.distance),
    calories: nullableNumber(value.calories),
    avgHeartRate: nullableNumber(value.avgHeartRate),
    maxHeartRate: nullableNumber(value.maxHeartRate),
    zones: Array.isArray(value.zones) && value.zones.every(isFiniteNumber) ? value.zones : null,
    effort: nullableNumber(value.effort),
    source: value.source === 'health' ? 'health' : 'manual',
    externalId: isString(value.externalId) ? value.externalId : null,
    sourceName: isString(value.sourceName) ? value.sourceName : null,
    notes: isString(value.notes) ? value.notes : '',
    updatedAt: optionalDate(value.updatedAt, startedAt, `cardio[${index}].updatedAt`),
  }
}

function parseAchievement(value: unknown, index: number): AchievementRecord {
  if (!isRecord(value)) throw new Error(`Conquista ${index + 1} invalida`)
  const unlockedAt = parseDate(value.unlockedAt, `achievements[${index}].unlockedAt`)
  return {
    id: requireString(value.id, `achievements[${index}].id`),
    unlockedAt,
    updatedAt: optionalDate(value.updatedAt, unlockedAt, `achievements[${index}].updatedAt`),
  }
}

function assertUniqueIds(items: Array<{ id: string }>, field: string) {
  const ids = new Set<string>()
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`ID duplicado em ${field}: ${item.id}`)
    ids.add(item.id)
  }
}

export function parseBackup(input: unknown): ParsedBackup {
  if (!isRecord(input)) throw new Error('O arquivo nao contem um objeto de backup')
  const legacy = input.schemaVersion == null
  if (!legacy && input.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error(`Versao de backup nao suportada: ${String(input.schemaVersion)}`)
  }
  if (!legacy && input.app !== 'WorkoutPro') throw new Error('Este arquivo nao pertence ao WorkoutPro')

  const source = legacy ? input : input.data
  if (!isRecord(source)) throw new Error('Conteudo do backup ausente')

  const workouts = requireArray(source.workouts, 'workouts').map(parseWorkout)
  const exercises = requireArray(source.exercises, 'exercises').map(parseExercise)
  const sessions = requireArray(source.sessions, 'sessions').map(parseSession)
  const measurements = requireArray(source.measurements, 'measurements').map(parseMeasurement)
  const profileValues = requireArray(source.profile, 'profile')
  const achievements = requireArray(source.achievements, 'achievements').map(parseAchievement)
  const cardio = source.cardio == null ? [] : requireArray(source.cardio, 'cardio').map(parseCardio)

  if (profileValues.length !== 1) throw new Error('O backup deve conter exatamente um perfil')
  const profile = [parseProfile(profileValues[0])]
  assertUniqueIds(workouts, 'workouts')
  assertUniqueIds(exercises, 'exercises')
  assertUniqueIds(sessions, 'sessions')
  assertUniqueIds(measurements, 'measurements')
  assertUniqueIds(achievements, 'achievements')
  assertUniqueIds(cardio, 'cardio')

  const knownExercises = new Set(exercises.map((item) => item.id))
  for (const workout of workouts) {
    if (workout.exerciseIds.some((id) => !knownExercises.has(id))) {
      throw new Error(`O treino ${workout.name} referencia um exercicio ausente`)
    }
  }

  const exportedAtValue = legacy ? input.exportedAt : input.exportedAt
  const exportedAt = exportedAtValue == null ? null : parseDate(exportedAtValue, 'exportedAt')
  const backup: WorkoutProBackup = {
    app: 'WorkoutPro',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: (exportedAt ?? new Date()).toISOString(),
    data: { workouts, exercises, sessions, measurements, profile, achievements, cardio },
  }
  return {
    backup,
    preview: {
      exportedAt,
      legacy,
      workouts: workouts.length,
      exercises: exercises.length,
      sessions: sessions.length,
      measurements: measurements.length,
      achievements: achievements.length,
      profileName: profile[0].name,
    },
  }
}

export async function exportData(): Promise<WorkoutProBackup> {
  const [workouts, exercises, sessions, measurements, profile, achievements, cardio] = await Promise.all([
    db.workouts.toArray(),
    db.exercises.toArray(),
    db.sessions.toArray(),
    db.measurements.toArray(),
    db.profile.toArray(),
    db.achievements.toArray(),
    db.cardio.toArray(),
  ])
  return {
    app: 'WorkoutPro',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: { workouts, exercises, sessions, measurements, profile, achievements, cardio },
  }
}

function syncItem(entity: SyncEntity, entityId: string, now: Date): SyncQueueItem {
  return {
    id: generateId(),
    entity,
    entityId,
    operation: 'upsert',
    createdAt: now,
    attempts: 0,
    lastError: null,
  }
}

export async function importData(parsed: ParsedBackup): Promise<BackupPreview> {
  const { data } = parsed.backup
  const now = new Date()
  const queueItems = [
    syncItem('profile', 'profile', now),
    ...data.workouts.map((item) => syncItem('workouts', item.id, now)),
    ...data.exercises.map((item) => syncItem('exercises', item.id, now)),
    ...data.sessions.map((item) => syncItem('sessions', item.id, now)),
    ...data.measurements.map((item) => syncItem('measurements', item.id, now)),
    ...data.achievements.map((item) => syncItem('achievements', item.id, now)),
    ...(data.cardio ?? []).map((item) => syncItem('cardio', item.id, now)),
  ]

  await db.transaction(
    'rw',
    [db.workouts, db.exercises, db.sessions, db.measurements, db.profile, db.achievements, db.cardio, db.syncQueue, db.syncConflicts],
    async () => {
      await Promise.all([
        db.workouts.clear(),
        db.exercises.clear(),
        db.sessions.clear(),
        db.measurements.clear(),
        db.profile.clear(),
        db.achievements.clear(),
        db.cardio.clear(),
        db.syncQueue.clear(),
        db.syncConflicts.clear(),
      ])
      if (data.workouts.length) await db.workouts.bulkAdd(data.workouts)
      if (data.exercises.length) await db.exercises.bulkAdd(data.exercises)
      if (data.sessions.length) await db.sessions.bulkAdd(data.sessions)
      if (data.measurements.length) await db.measurements.bulkAdd(data.measurements)
      await db.profile.bulkAdd(data.profile)
      if (data.achievements.length) await db.achievements.bulkAdd(data.achievements)
      if (data.cardio?.length) await db.cardio.bulkAdd(data.cardio)
      await db.syncQueue.bulkAdd(queueItems)
    }
  )

  if (typeof window !== 'undefined') window.dispatchEvent(new Event('workoutpro:sync-needed'))
  return parsed.preview
}
