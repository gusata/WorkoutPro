import { describe, expect, it } from 'vitest'
import { classifyExercise, generateWarmupSets, roundToPlates } from '@/lib/training'
import {
  applyPlanToSets, archiveBlock, blockRecords, blockWeekSummaries, defaultBaseWeeklySets, nextBlockDraft, planExerciseForWeek, summarizeBlock,
} from '@/lib/trainingBlocks'
import { discomfortHistory, parseDiscomfort, repeatedDiscomfort } from '@/lib/discomfort'
import { getExerciseCandidates, INTERNAL_CANDIDATES, normalizeExerciseName } from '@/lib/exerciseCandidates'
import { chooseSplit, generateRoutine, planToWorkouts, resolvePlanExercises } from '@/lib/routineGenerator'
import { parseBackup } from '@/lib/backup'
import { getExerciseHistory } from '@/lib/exerciseHistory'
import type { ActiveSet, CompletedSet, TrainingBlock, WorkoutSession } from '@/types'
import { makeExercise, makeSession, makeWorkout } from './fixtures'

function set(weight: number, reps: number, setType: CompletedSet['setType'] = 'normal'): CompletedSet {
  return { id: `${weight}-${reps}-${setType}-${Math.random()}`, weight, reps, rpe: null, rir: 2, setType, completedAt: new Date() }
}

function active(weight: number, completed: boolean, setType: ActiveSet['setType'] = 'normal', id = Math.random().toString()): ActiveSet {
  return { id, weight, reps: 10, rpe: null, rir: 2, setType, completed, completedAt: completed ? new Date() : null }
}

describe('warm-up generation', () => {
  it('ramps a heavy barbell lift: bar x10, 40% x8, 60% x5, 80% x3', () => {
    expect(generateWarmupSets(100, 20)).toEqual([
      { weight: 20, reps: 10 }, { weight: 40, reps: 8 }, { weight: 60, reps: 5 }, { weight: 80, reps: 3 },
    ])
  })

  it('rounds barbell warm-ups down to loads the plates can build', () => {
    expect(roundToPlates(37, 20)).toBe(35)
    expect(generateWarmupSets(92.5, 20)).toEqual([
      { weight: 20, reps: 10 }, { weight: 35, reps: 8 }, { weight: 55, reps: 5 }, { weight: 72.5, reps: 3 },
    ])
    expect(generateWarmupSets(60, 15).map((step) => step.weight)).toEqual([15, 22.5, 35, 47.5])
  })

  it('uses fewer sets for light loads and isolation exercises', () => {
    expect(generateWarmupSets(35, 20)).toEqual([{ weight: 20, reps: 10 }, { weight: 22.5, reps: 5 }])
    expect(generateWarmupSets(25, 20)).toEqual([{ weight: 20, reps: 10 }])
    expect(generateWarmupSets(20, 20)).toEqual([])
    expect(generateWarmupSets(0, 20)).toEqual([])
    expect(generateWarmupSets(30, 20, { barbell: false, isolation: true })).toEqual([{ weight: 15, reps: 10 }])
    expect(generateWarmupSets(8, 20, { barbell: false, isolation: true })).toEqual([])
    expect(generateWarmupSets(50, 20, { barbell: false })).toEqual([{ weight: 20, reps: 8 }, { weight: 30, reps: 5 }, { weight: 40, reps: 3 }])
  })

  it('classifies exercises for warm-ups', () => {
    expect(classifyExercise('Agachamento')).toEqual({ barbell: true, isolation: false })
    expect(classifyExercise('Rosca Direta', 'Halteres')).toEqual({ barbell: false, isolation: true })
    expect(classifyExercise('Leg Press').barbell).toBe(false)
    expect(classifyExercise('Supino', 'Barra').barbell).toBe(true)
  })

  it('keeps warm-ups out of exercise volume and records', () => {
    const session = makeSession({ exercises: [{ exerciseId: 'exercise-1', sets: [set(60, 10, 'warmup'), set(80, 8), set(80, 8)] }] })
    const [entry] = getExerciseHistory('exercise-1', [session], [makeWorkout()])
    expect(entry.sets).toBe(2)
    expect(entry.volume).toBe(1280)
    const warmupOnly = makeSession({ id: 's2', exercises: [{ exerciseId: 'exercise-1', sets: [set(200, 1, 'warmup')] }] })
    expect(getExerciseHistory('exercise-1', [warmupOnly], [])).toEqual([])
  })
})

describe('training block planning', () => {
  const block: TrainingBlock = {
    id: 'b', name: 'Hipertrofia', startDate: new Date('2026-08-03T00:00:00'), weeks: 4,
    baseWeeklySets: 60, weeklyIncreasePct: 10, deloadLastWeek: true, workoutIds: ['workout-1'],
  }
  const previousSets = [set(80, 10), set(80, 10)]
  const input = { block, workoutId: 'workout-1', baseSets: 3, previousSets, maxReps: 10, barbell: true, barWeight: 20 }

  it('ramps the sets of each exercise and keeps the load progression', () => {
    expect(planExerciseForWeek({ ...input, now: new Date('2026-08-04T10:00:00') })).toMatchObject({ weekNumber: 1, sets: 3, weight: 82.5, deload: false })
    expect(planExerciseForWeek({ ...input, now: new Date('2026-08-19T10:00:00') })).toMatchObject({ weekNumber: 3, sets: 4, weight: 82.5 })
  })

  it('halves the sets and drops the load ~10% in the deload week', () => {
    const now = new Date('2026-08-26T10:00:00')
    expect(planExerciseForWeek({ ...input, now })).toMatchObject({ weekNumber: 4, deload: true, sets: 2, weight: 70 })
    expect(planExerciseForWeek({ ...input, previousSets: [set(95, 8)], barbell: false, now })?.weight).toBe(85)
    expect(planExerciseForWeek({ ...input, previousSets: [set(95, 8)], now })?.weight).toBe(85)
    expect(planExerciseForWeek({ ...input, previousSets: [], now })?.weight).toBeNull()
  })

  it('only drives covered routines inside the block dates', () => {
    expect(planExerciseForWeek({ ...input, workoutId: 'other', now: new Date('2026-08-04T10:00:00') })).toBeNull()
    expect(planExerciseForWeek({ ...input, now: new Date('2026-07-30T10:00:00') })).toBeNull()
    expect(planExerciseForWeek({ ...input, now: new Date('2026-09-01T10:00:00') })).toBeNull()
    expect(planExerciseForWeek({ ...input, block: { ...block, workoutIds: [] }, workoutId: 'other', now: new Date('2026-08-04T10:00:00') })).not.toBeNull()
  })

  it('resizes pending work sets without touching warm-ups or completed sets', () => {
    const sets = [active(40, false, 'warmup', 'w'), active(80, true, 'normal', 'done'), active(80, false, 'normal', 'p1'), active(80, false, 'normal', 'p2')]
    const fewer = applyPlanToSets(sets, 2, 72.5)
    expect(fewer.map((item) => item.id)).toEqual(['w', 'done', 'p1'])
    expect(fewer.map((item) => item.weight)).toEqual([40, 80, 72.5])
    let n = 0
    const more = applyPlanToSets(sets, 5, null, () => `new-${n++}`)
    expect(more.filter((item) => item.setType !== 'warmup')).toHaveLength(5)
    expect(more.slice(-2).map((item) => [item.id, item.weight, item.completed])).toEqual([['new-0', 80, false], ['new-1', 80, false]])
  })

  it('compares planned and done sets per week, without warm-ups or uncovered routines', () => {
    const sessions: WorkoutSession[] = [
      makeSession({ id: 'w1', finishedAt: new Date('2026-08-05T19:00:00'), exercises: [{ exerciseId: 'exercise-1', sets: [set(40, 10, 'warmup'), set(80, 10), set(80, 10), set(80, 8)] }] }),
      makeSession({ id: 'w3', finishedAt: new Date('2026-08-20T19:00:00'), exercises: [{ exerciseId: 'exercise-1', sets: [set(85, 10), set(85, 10), set(85, 10), set(85, 10)] }] }),
      makeSession({ id: 'other', workoutId: 'workout-2', finishedAt: new Date('2026-08-05T19:00:00'), exercises: [{ exerciseId: 'exercise-1', sets: [set(80, 10)] }] }),
    ]
    const weeks = blockWeekSummaries(block, sessions)
    expect(weeks.map((week) => [week.targetSets, week.doneSets])).toEqual([[60, 3], [66, 0], [73, 4], [30, 0]])
    expect(weeks[0].volume).toBe(80 * 28)
    const summary = summarizeBlock(block, sessions, [makeExercise()])
    expect(summary.doneSets).toBe(7)
    expect(summary.volumeChangePct).toBe(Math.round(((3400 - 2240) / 2240) * 100))
  })

  it('lists records beaten inside the block', () => {
    const sessions = [
      makeSession({ id: 'before', finishedAt: new Date('2026-07-20T19:00:00'), exercises: [{ exerciseId: 'exercise-1', sets: [set(100, 5)] }] }),
      makeSession({ id: 'during', finishedAt: new Date('2026-08-12T19:00:00'), exercises: [{ exerciseId: 'exercise-1', sets: [set(105, 5), set(200, 5, 'warmup')] }] }),
    ]
    const records = blockRecords(block, sessions, [makeExercise({ name: 'Supino' })])
    expect(records).toHaveLength(1)
    expect(records[0].name).toBe('Supino')
    expect(records[0].after).toBeCloseTo(122.5)
  })

  it('archives blocks and drafts the next one', () => {
    const history = archiveBlock(block, [], new Date('2026-09-10T10:00:00'))
    expect(history[0].endedAt).toEqual(new Date('2026-08-31T00:00:00'))
    const early = archiveBlock(block, history, new Date('2026-08-10T10:00:00'))
    expect(early).toHaveLength(1)
    expect(early[0].endedAt).toEqual(new Date('2026-08-10T10:00:00'))
    const next = nextBlockDraft(block, new Date('2026-09-02T10:00:00'))
    expect(next.id).not.toBe(block.id)
    expect(next.baseWeeklySets).toBe(63)
    expect(next.startDate).toEqual(new Date('2026-09-07T00:00:00'))
    expect(next.workoutIds).toEqual(['workout-1'])
  })

  it('suggests a weekly base from the routines and their days', () => {
    const workouts = [
      makeWorkout({ exerciseIds: ['a', 'b'], exerciseConfigs: [{ exerciseId: 'a', targetSets: 4, minReps: 6, maxReps: 10, restSeconds: 90 }], scheduledWeekdays: [1, 4] }),
      makeWorkout({ id: 'workout-2', exerciseIds: ['c'] }),
    ]
    expect(defaultBaseWeeklySets(workouts)).toBe((4 + 3) * 2 + 3)
    expect(defaultBaseWeeklySets(workouts, ['workout-2'])).toBe(3)
  })
})

describe('routine generator', () => {
  const allEquipment = ['barra', 'halteres', 'maquina', 'cabo', 'kettlebell', 'elastico', 'peso-corporal'] as const
  const base = { goal: 'hipertrofia' as const, experience: 'intermediario' as const, sessionMinutes: 75, equipment: [...allEquipment] }

  it('picks the split by days per week', () => {
    expect([2, 3, 4, 5, 6].map((days) => [chooseSplit(days).split, chooseSplit(days).days.length])).toEqual([
      ['full-body', 2], ['full-body', 3], ['upper-lower', 4], ['upper-lower-ppl', 5], ['ppl', 6],
    ])
    expect(chooseSplit(9).days).toHaveLength(6)
  })

  it('never repeats an exercise inside a day and spreads the days over the week', () => {
    for (const days of [2, 3, 4, 5, 6]) {
      const plan = generateRoutine({ ...base, daysPerWeek: days }, getExerciseCandidates())
      expect(plan.days).toHaveLength(days)
      const weekdays = plan.days.flatMap((day) => day.weekdays)
      expect(new Set(weekdays).size).toBe(days)
      for (const day of plan.days) {
        const names = day.exercises.map((item) => normalizeExerciseName(item.candidate.name))
        expect(new Set(names).size).toBe(names.length)
        expect(day.exercises.length).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('varies A/B days and fits the session length', () => {
    const plan = generateRoutine({ ...base, daysPerWeek: 2 }, getExerciseCandidates())
    expect(plan.days[0].exercises[0].candidate.name).not.toBe(plan.days[1].exercises[0].candidate.name)
    const short = generateRoutine({ ...base, daysPerWeek: 3, sessionMinutes: 30 }, getExerciseCandidates())
    const long = generateRoutine({ ...base, daysPerWeek: 3, sessionMinutes: 90 }, getExerciseCandidates())
    expect(short.days[0].exercises.length).toBeLessThan(long.days[0].exercises.length)
  })

  it('respects equipment and goal prescriptions', () => {
    const plan = generateRoutine({ ...base, daysPerWeek: 3, equipment: [] }, getExerciseCandidates())
    expect(plan.days.flatMap((day) => day.exercises).every((item) => item.candidate.equipment === 'peso-corporal')).toBe(true)
    const strength = generateRoutine({ ...base, goal: 'forca', daysPerWeek: 4 }, getExerciseCandidates())
    const firstLift = strength.days[0].exercises[0]
    expect(firstLift.candidate.mechanic).toBe('compound')
    expect([firstLift.minReps, firstLift.maxReps, firstLift.restSeconds]).toEqual([3, 6, 180])
    expect(firstLift.progression.type).toBe('double-progression')
  })

  it('reuses existing exercises by normalized name and creates each missing one once', () => {
    const user = [makeExercise({ id: 'mine', name: 'supino  RETO', muscleGroup: 'Peitoral' }), makeExercise({ id: 'squat', name: 'Agachamento', muscleGroup: 'Quadríceps' })]
    const pool = getExerciseCandidates(user)
    expect(pool.filter((item) => normalizeExerciseName(item.name) === 'supino reto')).toHaveLength(1)
    expect(pool.find((item) => normalizeExerciseName(item.name) === 'agachamento')?.id).toBe('squat')

    const plan = generateRoutine({ ...base, daysPerWeek: 6 }, pool)
    const resolved = resolvePlanExercises(plan, user)
    const createdNames = resolved.toCreate.map((item) => normalizeExerciseName(item.name))
    expect(new Set(createdNames).size).toBe(createdNames.length)
    expect(createdNames).not.toContain('supino reto')
    expect(createdNames).not.toContain('agachamento')

    const ids = new Map(resolved.existing)
    resolved.toCreate.forEach((item, index) => ids.set(normalizeExerciseName(item.name), `new-${index}`))
    const workouts = planToWorkouts(plan, ids)
    expect(workouts).toHaveLength(6)
    expect(workouts[0].exerciseIds).toContain('mine')
    for (const workout of workouts) {
      expect(workout.exerciseConfigs).toHaveLength(workout.exerciseIds.length)
      expect(workout.scheduledWeekdays).toHaveLength(1)
    }
  })

  it('has a catalog without duplicate names', () => {
    const names = INTERNAL_CANDIDATES.map((item) => normalizeExerciseName(item.name))
    expect(new Set(names).size).toBe(names.length)
    const pool = getExerciseCandidates()
    expect(new Set(pool.map((item) => normalizeExerciseName(item.name))).size).toBe(pool.length)
  })
})

describe('discomfort', () => {
  const at = (day: number) => new Date(`2026-08-${String(day).padStart(2, '0')}T19:00:00`)
  const withExercise = (id: string, day: number, discomfort?: WorkoutSession['exercises'][number]['discomfort']) => makeSession({
    id, finishedAt: at(day), exercises: [{ exerciseId: 'exercise-1', sets: [set(80, 8)], ...(discomfort ? { discomfort } : {}) }],
  })
  const ombro = { location: 'ombro' as const, intensity: 2 as const }

  it('warns when 2 of the last 3 sessions had discomfort', () => {
    const sessions = [withExercise('s1', 1), withExercise('s2', 3, ombro), withExercise('s3', 5), withExercise('s4', 7, { location: 'cotovelo', intensity: 1 })]
    const warning = repeatedDiscomfort('exercise-1', sessions)
    expect(warning).toMatchObject({ count: 2, window: 3, latest: { location: 'cotovelo' } })
    expect(warning?.locations).toEqual(['cotovelo', 'ombro'])
  })

  it('ignores a single or old flag and the session in progress', () => {
    expect(repeatedDiscomfort('exercise-1', [withExercise('s1', 1, ombro), withExercise('s2', 3), withExercise('s3', 5), withExercise('s4', 7, ombro)])).toBeNull()
    expect(repeatedDiscomfort('exercise-1', [withExercise('s1', 1), withExercise('s2', 3, ombro)])).toBeNull()
    const sessions = [withExercise('s1', 1, ombro), withExercise('s2', 3, ombro)]
    expect(repeatedDiscomfort('exercise-1', sessions, { excludeSessionId: 's2' })).toBeNull()
    expect(repeatedDiscomfort('exercise-2', sessions)).toBeNull()
  })

  it('lists the history newest first and validates stored notes', () => {
    const history = discomfortHistory('exercise-1', [withExercise('s1', 1, ombro), withExercise('s2', 3), withExercise('s3', 5, { location: 'joelho', intensity: 3, note: 'pontada' })])
    expect(history.map((entry) => entry.sessionId)).toEqual(['s3', 's1'])
    expect(parseDiscomfort({ location: 'joelho', intensity: 3, note: '  pontada ' })).toEqual({ location: 'joelho', intensity: 3, note: 'pontada' })
    expect(parseDiscomfort({ location: 'nariz', intensity: 2 })).toBeNull()
    expect(parseDiscomfort({ location: 'ombro', intensity: 5 })).toBeNull()
    expect(parseDiscomfort(null)).toBeNull()
  })
})

describe('backup carries the new optional fields', () => {
  it('keeps discomfort, block details, block history and auto warm-up settings', () => {
    const now = new Date('2026-08-19T12:00:00').toISOString()
    const block = { id: 'b', name: 'Força', startDate: now, weeks: 5, baseWeeklySets: 40, weeklyIncreasePct: 5, deloadLastWeek: true, goal: 'forca', workoutIds: ['workout-1'] }
    const parsed = parseBackup(JSON.parse(JSON.stringify({
      workouts: [{ ...makeWorkout(), exerciseConfigs: [{ exerciseId: 'exercise-1', targetSets: 4, minReps: 3, maxReps: 6, restSeconds: 180, progression: { type: 'double-progression', increment: 2.5, minimumRir: 2 } }] }],
      exercises: [makeExercise()],
      sessions: [makeSession({ exercises: [{ exerciseId: 'exercise-1', sets: [set(80, 5)], discomfort: { location: 'lombar', intensity: 2, note: 'tensão' } }] })],
      measurements: [],
      profile: [{
        id: 'profile', name: 'Atleta', level: 1, xp: 0, totalVolume: 0, totalWorkouts: 0, streak: 0, longestStreak: 0, lastWorkoutDate: null, createdAt: now, updatedAt: now,
        trainingBlock: block,
        preferences: { autoWarmupExerciseIds: ['exercise-1'], trainingBlockHistory: [{ ...block, id: 'old', endedAt: now }] },
      }],
      achievements: [],
    })))
    const data = parsed.backup.data
    expect(data.sessions[0].exercises[0].discomfort).toEqual({ location: 'lombar', intensity: 2, note: 'tensão' })
    expect(data.workouts[0].exerciseConfigs?.[0].progression).toEqual({ type: 'double-progression', increment: 2.5, minimumRir: 2 })
    expect(data.profile[0].trainingBlock).toMatchObject({ goal: 'forca', workoutIds: ['workout-1'] })
    expect(data.profile[0].preferences?.autoWarmupExerciseIds).toEqual(['exercise-1'])
    expect(data.profile[0].preferences?.trainingBlockHistory?.[0].endedAt).toBeInstanceOf(Date)
  })
})
