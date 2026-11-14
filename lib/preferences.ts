import { differenceInCalendarDays } from 'date-fns'
import type { TrainingBlock, UserProfile, WeeklyGoals } from '@/types'

export const DEFAULT_GOALS: WeeklyGoals = { workouts: 4, minutes: 180, sets: 60 }
export const DEFAULT_BAR_WEIGHT = 20

export function getWeeklyGoals(profile: UserProfile | null | undefined): WeeklyGoals {
  return { ...DEFAULT_GOALS, ...(profile?.preferences?.weeklyGoals ?? {}) }
}

export interface BlockWeek {
  index: number
  start: Date
  targetSets: number
  deload: boolean
}

/** Weekly set targets for a block: compounding ramp, optional deload in the last week. */
export function getBlockWeeks(block: TrainingBlock): BlockWeek[] {
  const start = new Date(block.startDate)
  start.setHours(0, 0, 0, 0)
  return Array.from({ length: block.weeks }, (_, index) => {
    const deload = block.deloadLastWeek && index === block.weeks - 1 && block.weeks > 1
    const ramp = block.baseWeeklySets * Math.pow(1 + block.weeklyIncreasePct / 100, index)
    const weekStart = new Date(start)
    weekStart.setDate(start.getDate() + index * 7)
    return {
      index,
      start: weekStart,
      targetSets: Math.round(deload ? block.baseWeeklySets * 0.5 : ramp),
      deload,
    }
  })
}

export interface BlockProgress {
  week: BlockWeek | null
  weekNumber: number
  finished: boolean
  notStarted: boolean
}

export function getBlockProgress(block: TrainingBlock, now: Date = new Date()): BlockProgress {
  const days = differenceInCalendarDays(now, new Date(block.startDate))
  const weeks = getBlockWeeks(block)
  if (days < 0) return { week: null, weekNumber: 0, finished: false, notStarted: true }
  const index = Math.floor(days / 7)
  if (index >= block.weeks) return { week: null, weekNumber: block.weeks, finished: true, notStarted: false }
  return { week: weeks[index], weekNumber: index + 1, finished: false, notStarted: false }
}

/** Goals for this week, with the set target taken from an active training block. */
export function getEffectiveGoals(profile: UserProfile | null | undefined, now: Date = new Date()): WeeklyGoals & { fromBlock: boolean } {
  const goals = getWeeklyGoals(profile)
  const block = profile?.trainingBlock
  if (block) {
    const progress = getBlockProgress(block, now)
    if (progress.week) return { ...goals, sets: progress.week.targetSets, fromBlock: true }
  }
  return { ...goals, fromBlock: false }
}
