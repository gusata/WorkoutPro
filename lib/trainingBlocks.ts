import { addDays } from 'date-fns'
import type { ActiveSet, Exercise, ProgressionRule, TrainingBlock, TrainingGoal, Workout, WorkoutSession } from '@/types'
import { getBlockProgress, getBlockWeeks, type BlockWeek } from '@/lib/preferences'
import { estimateOneRm } from '@/lib/exerciseHistory'
import { getProgressionSuggestion, roundToPlates } from '@/lib/training'
import { generateId } from '@/lib/utils'

export const TRAINING_GOALS: Array<{ value: TrainingGoal; label: string }> = [
  { value: 'hipertrofia', label: 'Hipertrofia' },
  { value: 'forca', label: 'Força' },
  { value: 'condicionamento', label: 'Condicionamento' },
]

export const DELOAD_SET_FACTOR = 0.5
export const DELOAD_LOAD_FACTOR = 0.9
export const MIN_BLOCK_WEEKS = 4
export const MAX_BLOCK_WEEKS = 8

export function goalLabel(goal?: TrainingGoal) {
  return TRAINING_GOALS.find((item) => item.value === goal)?.label ?? null
}

function isWorkSet(set: { setType?: string }) {
  return (set.setType ?? 'normal') !== 'warmup'
}

export function blockCoversWorkout(block: TrainingBlock, workoutId: string) {
  return !block.workoutIds?.length || block.workoutIds.includes(workoutId)
}

/** Monday 00:00 of the current week, or of the next week when `next`. */
export function mondayOf(from = new Date(), next = false) {
  const date = new Date(from)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay()
  const back = day === 0 ? 6 : day - 1
  date.setDate(date.getDate() - back + (next ? 7 : 0))
  return date
}

/** Exclusive end of the block (start + weeks), or when it was ended early. */
export function blockEndDate(block: TrainingBlock) {
  const planned = addDays(new Date(block.startDate), block.weeks * 7)
  if (block.endedAt && new Date(block.endedAt) < planned) return new Date(block.endedAt)
  return planned
}

/** Weekly hard-set baseline from the routines' configured sets × how often each is scheduled. */
export function defaultBaseWeeklySets(workouts: Workout[], workoutIds?: string[]) {
  const covered = workouts.filter((workout) => !workoutIds?.length || workoutIds.includes(workout.id))
  const total = covered.reduce((sum, workout) => {
    const sets = workout.exerciseIds.reduce((acc, id) => acc + (workout.exerciseConfigs?.find((item) => item.exerciseId === id)?.targetSets ?? 3), 0)
    return sum + sets * Math.max(1, workout.scheduledWeekdays?.length ?? 0)
  }, 0)
  return Math.max(1, Math.min(300, total))
}

/** Ratio of a week's planned volume to week 1 (1.0, 1.1, 1.21... deload 0.5). */
export function weekVolumeFactor(block: TrainingBlock, week: Pick<BlockWeek, 'index' | 'deload'>) {
  if (week.deload) return DELOAD_SET_FACTOR
  return Math.pow(1 + block.weeklyIncreasePct / 100, week.index)
}

export interface ExercisePlan {
  weekNumber: number
  totalWeeks: number
  deload: boolean
  sets: number
  /** Suggested working load; null when there is no history to base it on. */
  weight: number | null
  reason: string
}

export interface ExercisePlanInput {
  block: TrainingBlock
  workoutId: string
  /** Sets configured for the exercise in the routine (week-1 baseline). */
  baseSets: number
  previousSets: Array<{ weight: number; reps: number; rir?: number | null; setType?: ActiveSet['setType'] }>
  maxReps: number
  progression?: ProgressionRule
  barbell?: boolean
  barWeight?: number
  now?: Date
}

function roundLoad(weight: number, barbell: boolean, barWeight: number) {
  if (weight <= 0) return 0
  if (barbell) return Math.max(barWeight, roundToPlates(weight, barWeight))
  return Math.max(0, Math.floor(weight / 2.5) * 2.5)
}

/**
 * What the active block asks of one exercise this week: set count ramps with the block,
 * the deload week halves the sets and drops the load ~10%. Returns null outside a block
 * or for routines the block does not cover.
 */
export function planExerciseForWeek(input: ExercisePlanInput): ExercisePlan | null {
  const { block } = input
  if (!blockCoversWorkout(block, input.workoutId)) return null
  const progress = getBlockProgress(block, input.now)
  if (!progress.week) return null
  const week = progress.week
  const base = Math.max(1, Math.round(input.baseSets))
  const workSets = input.previousSets.filter(isWorkSet)
  const lastWeight = workSets.length ? Math.max(...workSets.map((set) => set.weight)) : 0
  const barWeight = input.barWeight ?? 20
  if (week.deload) {
    const weight = lastWeight > 0 ? roundLoad(lastWeight * DELOAD_LOAD_FACTOR, Boolean(input.barbell), barWeight) : null
    return {
      weekNumber: progress.weekNumber, totalWeeks: block.weeks, deload: true,
      sets: Math.max(1, Math.round(base * DELOAD_SET_FACTOR)),
      weight,
      reason: 'Semana de deload: metade das séries e carga ~10% menor para recuperar.',
    }
  }
  const sets = Math.max(1, Math.min(10, Math.round(base * weekVolumeFactor(block, week))))
  const suggestion = getProgressionSuggestion(workSets, input.maxReps, input.progression)
  return {
    weekNumber: progress.weekNumber, totalWeeks: block.weeks, deload: false,
    sets,
    weight: suggestion?.weight ?? null,
    reason: sets > base ? `Volume do bloco subindo: ${sets} séries nesta semana.` : `${sets} séries nesta semana.`,
  }
}

/**
 * Resize the working sets of an exercise to `target` (completed sets and warm-ups are kept),
 * optionally setting the load of the pending working sets.
 */
export function applyPlanToSets(sets: ActiveSet[], target: number, weight: number | null, makeId: () => string = generateId): ActiveSet[] {
  const result = sets.map((set) => (!set.completed && isWorkSet(set) && weight != null ? { ...set, weight } : set))
  let work = result.filter(isWorkSet).length
  while (work > target) {
    let index = -1
    for (let cursor = result.length - 1; cursor >= 0; cursor -= 1) {
      if (!result[cursor].completed && isWorkSet(result[cursor])) { index = cursor; break }
    }
    if (index < 0) break
    result.splice(index, 1)
    work -= 1
  }
  const template = [...result].reverse().find(isWorkSet)
  while (work < target) {
    result.push({
      id: makeId(), weight: weight ?? template?.weight ?? 0, reps: template?.reps ?? 8, rpe: null,
      rir: template?.rir ?? null, setType: 'normal', completed: false, completedAt: null,
    })
    work += 1
  }
  return result
}

export function planMatchesSets(sets: ActiveSet[], plan: Pick<ExercisePlan, 'sets' | 'weight'>) {
  const work = sets.filter(isWorkSet)
  if (work.length !== plan.sets) return false
  return plan.weight == null || work.filter((set) => !set.completed).every((set) => set.weight === plan.weight)
}

export interface BlockWeekSummary extends BlockWeek {
  doneSets: number
  volume: number
  sessions: number
}

function sessionsInBlock(block: TrainingBlock, sessions: WorkoutSession[]) {
  const start = new Date(block.startDate)
  const end = blockEndDate(block)
  return sessions.filter((session) => {
    if (!session.finishedAt || !blockCoversWorkout(block, session.workoutId)) return false
    const date = new Date(session.finishedAt)
    return date >= start && date < end
  })
}

/** Planned weekly sets next to what was actually done (work sets and volume, warm-ups excluded). */
export function blockWeekSummaries(block: TrainingBlock, sessions: WorkoutSession[]): BlockWeekSummary[] {
  const inBlock = sessionsInBlock(block, sessions)
  return getBlockWeeks(block).map((week) => {
    const end = addDays(week.start, 7)
    const weekSessions = inBlock.filter((session) => new Date(session.finishedAt!) >= week.start && new Date(session.finishedAt!) < end)
    let doneSets = 0
    let volume = 0
    for (const session of weekSessions) {
      for (const item of session.exercises) {
        for (const set of item.sets) {
          if (!isWorkSet(set)) continue
          doneSets += 1
          volume += set.weight * set.reps
        }
      }
    }
    return { ...week, doneSets, volume, sessions: weekSessions.length }
  })
}

export interface BlockRecord {
  exerciseId: string
  name: string
  before: number
  after: number
}

/** Exercises whose best estimated 1RM inside the block beat everything before it. */
export function blockRecords(block: TrainingBlock, sessions: WorkoutSession[], exercises: Exercise[]): BlockRecord[] {
  const start = new Date(block.startDate)
  const inBlock = new Set(sessionsInBlock(block, sessions).map((session) => session.id))
  const before = new Map<string, number>()
  const during = new Map<string, number>()
  for (const session of sessions) {
    if (!session.finishedAt) continue
    const target = inBlock.has(session.id) ? during : new Date(session.finishedAt) < start ? before : null
    if (!target) continue
    for (const item of session.exercises) {
      for (const set of item.sets) {
        if (!isWorkSet(set)) continue
        const estimate = estimateOneRm(set.weight, set.reps)
        if (estimate > (target.get(item.exerciseId) ?? 0)) target.set(item.exerciseId, estimate)
      }
    }
  }
  const names = new Map(exercises.map((exercise) => [exercise.id, exercise.name]))
  return [...during]
    .filter(([id, best]) => (before.get(id) ?? 0) > 0 && best > (before.get(id) ?? 0) + 0.01)
    .map(([id, best]) => ({ exerciseId: id, name: names.get(id) ?? 'Exercício', before: before.get(id)!, after: best }))
    .sort((a, b) => (b.after - b.before) / b.before - (a.after - a.before) / a.before)
}

export interface BlockSummary {
  weeks: BlockWeekSummary[]
  plannedSets: number
  doneSets: number
  volume: number
  sessions: number
  /** Volume change between the first and the last non-deload week that had training. */
  volumeChangePct: number | null
  records: BlockRecord[]
}

export function summarizeBlock(block: TrainingBlock, sessions: WorkoutSession[], exercises: Exercise[]): BlockSummary {
  const weeks = blockWeekSummaries(block, sessions)
  const trained = weeks.filter((week) => !week.deload && week.volume > 0)
  const first = trained[0]
  const last = trained.at(-1)
  return {
    weeks,
    plannedSets: weeks.reduce((sum, week) => sum + week.targetSets, 0),
    doneSets: weeks.reduce((sum, week) => sum + week.doneSets, 0),
    volume: weeks.reduce((sum, week) => sum + week.volume, 0),
    sessions: weeks.reduce((sum, week) => sum + week.sessions, 0),
    volumeChangePct: first && last && first !== last ? Math.round(((last.volume - first.volume) / first.volume) * 100) : null,
    records: blockRecords(block, sessions, exercises),
  }
}

/** Archive a block (it keeps its settings, gets `endedAt`) at the front of the history. */
export function archiveBlock(block: TrainingBlock, history: TrainingBlock[] = [], now = new Date()): TrainingBlock[] {
  const plannedEnd = addDays(new Date(block.startDate), block.weeks * 7)
  const ended: TrainingBlock = { ...block, endedAt: block.endedAt ?? (plannedEnd < now ? plannedEnd : now) }
  return [ended, ...history.filter((item) => item.id !== block.id)].slice(0, 30)
}

/** Settings for the block that follows: same structure, starts on the next Monday, ~5% more base volume. */
export function nextBlockDraft(previous: TrainingBlock, now = new Date()): TrainingBlock {
  return {
    ...previous,
    id: generateId(),
    startDate: mondayOf(now, now.getDay() !== 1),
    baseWeeklySets: Math.round(previous.baseWeeklySets * 1.05),
    endedAt: null,
  }
}
