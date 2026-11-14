import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MUSCLE_TARGETS, getMuscleTargets, lateWeekNudge, MUSCLES, muscleContributions, muscleIntensity,
  muscleVolumeInRange, volumeStatus, weeklyMuscleReport,
} from '@/lib/muscleVolume'
import { makeExercise, makeSession } from './fixtures'
import type { CompletedSet, Exercise, MuscleGroup } from '@/types'

function sets(count: number, type: CompletedSet['setType'] = 'normal'): CompletedSet[] {
  return Array.from({ length: count }, (_, index) => ({ id: `${type}-${index}`, weight: 50, reps: 10, rpe: null, setType: type, completedAt: new Date() }))
}

const bench = makeExercise({ id: 'bench', name: 'Empurrar teste', muscleGroup: 'Peitoral' })
const benchWithSecondaries = { ...bench, secondaryMuscles: ['Tríceps', 'Ombros', 'Peitoral'] as MuscleGroup[] } as Exercise
const burpee = makeExercise({ id: 'burpee', name: 'Circuito teste', muscleGroup: 'Full Body' })
const squat = makeExercise({ id: 'squat', name: 'Perna teste', muscleGroup: 'Quadríceps' })

// Wednesday 2026-08-19; the week starts Monday 2026-08-17.
const WED = new Date('2026-08-19T20:00:00-03:00')
const FRI = new Date('2026-08-21T20:00:00-03:00')

describe('muscle contributions', () => {
  it('counts the primary muscle once and works without secondaries', () => {
    expect(muscleContributions(bench)).toEqual([{ muscle: 'Peitoral', weight: 1 }])
  })

  it('counts secondary muscles as half a set and ignores duplicates of the primary', () => {
    expect(muscleContributions(benchWithSecondaries)).toEqual([
      { muscle: 'Peitoral', weight: 1 },
      { muscle: 'Tríceps', weight: 0.5 },
      { muscle: 'Ombros', weight: 0.5 },
    ])
  })

  it('accepts a custom resolver (e.g. an exercise library lookup)', () => {
    expect(muscleContributions(bench, { secondaryMuscles: () => ['Bíceps'] })).toEqual([
      { muscle: 'Peitoral', weight: 1 },
      { muscle: 'Bíceps', weight: 0.5 },
    ])
  })

  it('spreads full-body work across every muscle', () => {
    const result = muscleContributions(burpee)
    expect(result).toHaveLength(MUSCLES.length)
    expect(result.every((item) => item.weight === 0.5)).toBe(true)
  })
})

describe('muscleVolumeInRange', () => {
  it('ignores warm-ups, credits secondaries and lists the exercises', () => {
    const sessions = [
      makeSession({ id: 'a', finishedAt: new Date('2026-08-18T19:00:00-03:00'), exercises: [{ exerciseId: 'bench', sets: [...sets(4), ...sets(2, 'warmup'), ...sets(1, 'drop')] }] }),
      makeSession({ id: 'b', finishedAt: new Date('2026-08-10T19:00:00-03:00'), exercises: [{ exerciseId: 'bench', sets: sets(10) }] }),
    ]
    const volume = muscleVolumeInRange(sessions, [benchWithSecondaries], new Date('2026-08-17T00:00:00-03:00'), WED)
    expect(volume.get('Peitoral')?.sets).toBe(5)
    expect(volume.get('Tríceps')?.sets).toBe(2.5)
    expect(volume.get('Tríceps')?.exercises[0]).toMatchObject({ name: 'Supino', sets: 5, credited: 2.5, primary: false })
    expect(volume.has('Costas')).toBe(false)
  })
})

describe('targets and status', () => {
  it('uses defaults and validates custom ranges', () => {
    const targets = getMuscleTargets({ muscleTargets: { Peitoral: { min: 12, max: 22 }, Bíceps: { min: 9, max: 3 } } })
    expect(targets.Peitoral).toEqual({ min: 12, max: 22 })
    expect(targets.Bíceps).toEqual(DEFAULT_MUSCLE_TARGETS.Bíceps)
    expect(targets.Quadríceps).toEqual({ min: 10, max: 20 })
    expect(targets.Panturrilha).toEqual({ min: 6, max: 12 })
  })

  it('classifies below / within / above', () => {
    const target = { min: 10, max: 20 }
    expect(volumeStatus(9.5, target)).toBe('below')
    expect(volumeStatus(10, target)).toBe('within')
    expect(volumeStatus(20, target)).toBe('within')
    expect(volumeStatus(21, target)).toBe('above')
    expect(muscleIntensity(0)).toBe(0)
    expect(muscleIntensity(4.5)).toBe(1)
    expect(muscleIntensity(20)).toBe(4)
  })
})

describe('weekly report and nudge', () => {
  const sessions = [
    // Previous weeks: both muscles are part of the routine.
    makeSession({ id: 'old', finishedAt: new Date('2026-08-05T19:00:00-03:00'), exercises: [{ exerciseId: 'bench', sets: sets(4) }, { exerciseId: 'squat', sets: sets(4) }] }),
    // This week: plenty of chest, little quads.
    makeSession({ id: 'mon', finishedAt: new Date('2026-08-17T19:00:00-03:00'), exercises: [{ exerciseId: 'bench', sets: sets(12) }, { exerciseId: 'squat', sets: sets(3) }] }),
  ]

  it('builds one row per muscle with status and routine flag', () => {
    const rows = weeklyMuscleReport(sessions, [bench, squat], getMuscleTargets(undefined), WED)
    const chest = rows.find((row) => row.muscle === 'Peitoral')!
    const quads = rows.find((row) => row.muscle === 'Quadríceps')!
    expect(rows).toHaveLength(MUSCLES.length)
    expect(chest).toMatchObject({ sets: 12, status: 'within', inRoutine: true })
    expect(quads).toMatchObject({ sets: 3, status: 'below', inRoutine: true })
    expect(rows.find((row) => row.muscle === 'Panturrilha')!.inRoutine).toBe(false)
    const lastWeek = weeklyMuscleReport(sessions, [bench, squat], getMuscleTargets(undefined), WED, 1)
    expect(lastWeek.find((row) => row.muscle === 'Peitoral')!.sets).toBe(0)
  })

  it('nudges only late in the week, for routine muscles below target', () => {
    const rows = weeklyMuscleReport(sessions, [bench, squat], getMuscleTargets(undefined), FRI)
    expect(lateWeekNudge(rows, WED)).toBeNull()
    const nudge = lateWeekNudge(rows, FRI)!
    expect(nudge.muscle).toBe('Quadríceps')
    expect(nudge.missing).toBe(7)
    expect(nudge.message).toContain('Faltam 7 séries e 2 dias')
  })

  it('stays quiet when everything in the routine is on target', () => {
    const done = [...sessions, makeSession({ id: 'thu', finishedAt: new Date('2026-08-20T19:00:00-03:00'), exercises: [{ exerciseId: 'squat', sets: sets(8) }] })]
    expect(lateWeekNudge(weeklyMuscleReport(done, [bench, squat], getMuscleTargets(undefined), FRI), FRI)).toBeNull()
  })
})

describe('secondary muscles from the exercise library', () => {
  it('uses the linked library entry when the exercise has no own secondaries', async () => {
    const { muscleContributions } = await import('@/lib/muscleVolume')
    const { getLibraryExercise } = await import('@/lib/exerciseLibrary')
    const bench = getLibraryExercise('supino-reto-barra')!
    const contributions = muscleContributions({ id: 'x', name: 'Meu supino', muscleGroup: 'Peitoral', notes: '', libraryId: bench.id, createdAt: new Date(), updatedAt: new Date() })
    for (const muscle of bench.secondaryMuscles) expect(contributions).toContainEqual({ muscle, weight: 0.5 })
  })
})
