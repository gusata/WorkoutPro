import { describe, expect, it } from 'vitest'
import { makeExercise, makeProfile, makeSession, makeWorkout } from './fixtures'
import { generateWarmupSets } from '@/lib/training'
import {
  bestsByExercise, buildRecap, getDeloadAdvice, heatLevel, muscleLevel, muscleSetsInRange, recordForSet, trendPer30Days, volumeComparison,
} from '@/lib/insights'
import { getBlockProgress, getBlockWeeks, getEffectiveGoals } from '@/lib/preferences'
import { reminderMessage, reminderTime, usualTrainingTime, workoutsForWeekday } from '@/lib/reminders'
import type { CompletedSet, TrainingBlock } from '@/types'

function set(weight: number, reps: number, setType: CompletedSet['setType'] = 'normal'): CompletedSet {
  return { id: `${weight}-${reps}-${Math.random()}`, weight, reps, rpe: null, rir: 2, setType, completedAt: new Date('2026-08-19T12:30:00-03:00') }
}

function sessionOn(day: string, sets: CompletedSet[], exerciseId = 'exercise-1', id = day) {
  const finishedAt = new Date(`${day}T19:00:00-03:00`)
  return makeSession({
    id,
    startedAt: new Date(finishedAt.getTime() - 3600_000),
    finishedAt,
    exercises: [{ exerciseId, sets }],
    totalVolume: sets.reduce((total, item) => total + item.weight * item.reps, 0),
  })
}

describe('warm-up generator', () => {
  it('ramps up to a heavy working weight starting with the empty bar', () => {
    expect(generateWarmupSets(100)).toEqual([{ weight: 20, reps: 10 }, { weight: 40, reps: 8 }, { weight: 60, reps: 5 }, { weight: 80, reps: 3 }])
  })

  it('uses fewer steps for light loads and never goes below the bar', () => {
    expect(generateWarmupSets(40)).toEqual([{ weight: 20, reps: 10 }, { weight: 27.5, reps: 5 }])
    expect(generateWarmupSets(25)).toEqual([{ weight: 20, reps: 10 }])
    expect(generateWarmupSets(0)).toEqual([])
  })
})

describe('personal records', () => {
  it('ignores warm-ups and flags weight and estimated 1RM records', () => {
    const bests = bestsByExercise([sessionOn('2026-08-10', [set(100, 5), set(140, 1, 'warmup')])])
    expect(bests.get('exercise-1')?.weight).toBe(100)
    expect(recordForSet(bests.get('exercise-1'), 102.5, 3)).toBe('weight')
    expect(recordForSet(bests.get('exercise-1'), 100, 8)).toBe('oneRm')
    expect(recordForSet(bests.get('exercise-1'), 95, 5)).toBeNull()
    expect(recordForSet(undefined, 50, 10)).toBeNull()
  })
})

describe('muscle map', () => {
  it('counts hard sets per group and splits full-body work', () => {
    const exercises = [makeExercise(), makeExercise({ id: 'fb', muscleGroup: 'Full Body' })]
    const sessions = [
      sessionOn('2026-08-18', [set(80, 8), set(80, 8), set(40, 10, 'warmup')]),
      sessionOn('2026-08-19', [set(60, 10), set(60, 10)], 'fb', 'fb-session'),
    ]
    const totals = muscleSetsInRange(sessions, exercises, new Date('2026-08-12T00:00:00-03:00'), new Date('2026-08-20T00:00:00-03:00'))
    expect(totals.get('Peitoral')).toBe(3)
    expect(totals.get('Costas')).toBe(1)
    expect(muscleLevel(0)).toBe(0)
    expect(muscleLevel(5)).toBe(1)
    expect(muscleLevel(12)).toBe(3)
  })
})

describe('deload advice', () => {
  it('suggests a deload when the only tracked lift drops three sessions in a row', () => {
    const sessions = [
      sessionOn('2026-08-05', [set(100, 8)]),
      sessionOn('2026-08-10', [set(100, 6)]),
      sessionOn('2026-08-15', [set(97.5, 5)]),
    ]
    const advice = getDeloadAdvice(sessions, [makeExercise()], new Date('2026-08-19T12:00:00-03:00'))
    expect(advice.suggested).toBe(true)
    expect(advice.declining[0]).toMatchObject({ exerciseId: 'exercise-1', name: 'Supino' })
  })

  it('stays quiet while performance holds', () => {
    const sessions = [
      sessionOn('2026-08-05', [set(100, 8)]),
      sessionOn('2026-08-10', [set(100, 6)]),
      sessionOn('2026-08-15', [set(100, 8)]),
    ]
    expect(getDeloadAdvice(sessions, [makeExercise()], new Date('2026-08-19T12:00:00-03:00')).suggested).toBe(false)
  })
})

describe('trend and heatmap', () => {
  it('reports the slope per 30 days', () => {
    const slope = trendPer30Days([
      { date: new Date('2026-08-01'), value: 100 },
      { date: new Date('2026-08-31'), value: 103 },
    ])
    expect(slope).toBeCloseTo(3)
    expect(trendPer30Days([{ date: new Date('2026-08-01'), value: 100 }])).toBeNull()
  })

  it('buckets daily sets into heat levels', () => {
    expect([0, 5, 12, 20, 40].map(heatLevel)).toEqual([0, 1, 2, 3, 4])
  })
})

describe('recap', () => {
  it('summarises a month', () => {
    const workouts = [makeWorkout()]
    const exercises = [makeExercise()]
    const sessions = [
      sessionOn('2026-07-20', [set(90, 8)]),
      sessionOn('2026-08-03', [set(95, 8), set(95, 8)]),
      sessionOn('2026-08-04', [set(100, 8)]),
    ]
    const recap = buildRecap(sessions, workouts, exercises, new Date('2026-08-01T00:00:00-03:00'), new Date('2026-08-31T23:59:59-03:00'))
    expect(recap.sessions).toBe(2)
    expect(recap.activeDays).toBe(2)
    expect(recap.longestStreak).toBe(2)
    expect(recap.records).toBe(2)
    expect(recap.topExercise).toEqual({ name: 'Supino', sets: 3 })
    expect(recap.heaviest).toEqual({ name: 'Supino', weight: 100 })
    expect(recap.favoriteWorkout?.name).toBe('Treino A')
  })

  it('compares volume with something tangible', () => {
    expect(volumeComparison(12_000)).toBe('2 elefantes')
    expect(volumeComparison(100)).toBeNull()
  })
})

describe('training blocks', () => {
  const block: TrainingBlock = {
    id: 'b', name: 'Hipertrofia', startDate: new Date('2026-08-03T00:00:00'), weeks: 4,
    baseWeeklySets: 60, weeklyIncreasePct: 10, deloadLastWeek: true,
  }

  it('ramps the weekly set target and ends with a deload', () => {
    expect(getBlockWeeks(block).map((week) => week.targetSets)).toEqual([60, 66, 73, 30])
    expect(getBlockWeeks(block)[3].deload).toBe(true)
  })

  it('drives the weekly set goal while active', () => {
    const now = new Date('2026-08-12T10:00:00')
    expect(getBlockProgress(block, now).weekNumber).toBe(2)
    expect(getEffectiveGoals(makeProfile({ trainingBlock: block }), now)).toMatchObject({ sets: 66, fromBlock: true })
    expect(getEffectiveGoals(makeProfile({ trainingBlock: block }), new Date('2026-09-10T10:00:00')).fromBlock).toBe(false)
    expect(getEffectiveGoals(makeProfile()).sets).toBe(60)
  })
})

describe('reminders', () => {
  it('learns the usual training time and fires 30 minutes earlier', () => {
    const sessions = ['18:00', '18:30', '19:00'].map((time, index) => makeSession({
      id: `s${index}`,
      startedAt: new Date(`2026-08-1${index}T${time}:00`),
      finishedAt: new Date(`2026-08-1${index}T20:00:00`),
    }))
    expect(usualTrainingTime(sessions)).toBe(18 * 60 + 30)
    expect(reminderTime({ enabled: true, timeOfDay: null }, sessions)).toBe(18 * 60)
    expect(reminderTime({ enabled: true, timeOfDay: 7 * 60 }, sessions)).toBe(7 * 60)
    expect(reminderTime({ enabled: true, timeOfDay: null }, [])).toBe(17 * 60 + 30)
  })

  it('names the workouts planned for the day', () => {
    const workouts = [makeWorkout({ name: 'Superior A', scheduledWeekdays: [1, 4] }), makeWorkout({ id: 'w2', name: 'Cardio', scheduledWeekdays: [1] })]
    expect(workoutsForWeekday(workouts, 4).map((workout) => workout.name)).toEqual(['Superior A'])
    expect(reminderMessage(workoutsForWeekday(workouts, 1).map((workout) => workout.name))).toBe('Hoje é dia de Superior A e Cardio')
    expect(reminderMessage([])).toBeNull()
  })
})
