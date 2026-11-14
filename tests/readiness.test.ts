import { describe, expect, it } from 'vitest'
import {
  adjustWeight, applyReadinessToSuggestion, computeReadiness, computeTrainingLoad, loadAdjustmentFor, readinessLoadAdjustment, recommendationForScore,
  type ReadinessInput, type TrainingLoad,
} from '@/lib/readiness'
import { makeExercise, makeSession } from './fixtures'
import type { CompletedSet } from '@/types'

const NOW = new Date('2026-08-19T08:00:00-03:00')
const day = (offset: number) => new Date(NOW.getTime() - offset * 86_400_000)

function series(values: number[]) {
  // Oldest first, last value = today.
  return values.map((value, index) => ({ date: day(values.length - 1 - index), value }))
}

function base(overrides: Partial<ReadinessInput> = {}): ReadinessInput {
  return { hrv: [], restingHr: [], sleep: null, recentSets: 0, now: NOW, ...overrides }
}

function load(overrides: Partial<TrainingLoad> = {}): TrainingLoad {
  return { acuteSets: 40, chronicWeeklySets: 40, ratio: 1, lastSessionDaysAgo: 1, muscles: [], ...overrides }
}

function hard(count: number, type: CompletedSet['setType'] = 'normal'): CompletedSet[] {
  return Array.from({ length: count }, (_, index) => ({ id: `${type}-${index}`, weight: 50, reps: 10, rpe: null, setType: type, completedAt: NOW }))
}

describe('computeReadiness', () => {
  it('returns null with no watch data and no training history', () => {
    expect(computeReadiness(base())).toBeNull()
    expect(computeReadiness(base({ training: load({ ratio: null }) }))).toBeNull()
  })

  it('ignores stale or too-short series', () => {
    const stale = [1, 2, 3, 4, 5].map((index) => ({ date: day(index + 3), value: 60 }))
    expect(computeReadiness(base({ hrv: series([60, 62]), restingHr: stale }))).toBeNull()
  })

  it('scores from training load alone and marks the basis', () => {
    const result = computeReadiness(base({ training: load() }))
    expect(result).not.toBeNull()
    expect(result!.basis).toBe('training')
    expect(result!.components.map((item) => item.key)).toEqual(['load', 'acwr'])
    expect(result!.recommendation.level).toBe('normal')
  })

  it('keeps the old behaviour (no acwr) when training is not passed', () => {
    const result = computeReadiness(base({ sleep: { asleep: 480, deep: 90, rem: 100, hasStages: true, end: NOW } }))
    expect(result!.basis).toBe('full')
    expect(result!.components.map((item) => item.key)).toEqual(['sleep', 'load'])
    expect(result!.level).toBe('high')
    expect(result!.headline).toBe('Pronto para treinar pesado.')
  })

  it('lowers the recommendation for a load spike and lists the reason first', () => {
    const result = computeReadiness(base({
      sleep: { asleep: 480, deep: 90, rem: 100, hasStages: true, end: NOW },
      training: load({ acuteSets: 80, chronicWeeklySets: 40, ratio: 2 }),
    }))
    expect(result!.recommendation.level).not.toBe('normal')
    expect(result!.recommendation.reasons[0].text).toContain('2,0×')
    expect(result!.recommendation.reasons[0].tone).toBe('negative')
  })

  it('recommends rest when HRV crashes, resting HR jumps and sleep is short', () => {
    const result = computeReadiness(base({
      hrv: series([60, 62, 58, 61, 60, 35]),
      restingHr: series([52, 53, 51, 52, 52, 64]),
      sleep: { asleep: 240, deep: 20, rem: 20, hasStages: true, end: NOW },
      recentSets: 30,
    }))
    expect(result!.score).toBeLessThan(40)
    expect(result!.recommendation.level).toBe('descanso')
    expect(result!.recommendation.reasons.length).toBeGreaterThan(0)
    expect(result!.recommendation.reasons.every((reason) => reason.tone === 'negative')).toBe(true)
  })

  it('short sleep alone caps the day at moderate even with a good score', () => {
    const result = computeReadiness(base({
      hrv: series([60, 62, 58, 61, 60, 75]),
      sleep: { asleep: 280, deep: 60, rem: 60, hasStages: false, end: NOW },
    }))
    expect(result!.recommendation.level).not.toBe('normal')
  })

  it('mentions muscles trained hard in the last day', () => {
    const result = computeReadiness(base({
      training: load({ muscles: [{ muscle: 'Quadríceps', daysSince: 1, sets: 12 }, { muscle: 'Bíceps', daysSince: 1, sets: 3 }] }),
    }))
    const text = result!.recommendation.reasons.map((reason) => reason.text).join(' ')
    expect(text).toContain('Quadríceps (ontem, 12 séries)')
    expect(text).not.toContain('Bíceps')
  })
})

describe('computeTrainingLoad', () => {
  const exercises = [makeExercise()]

  it('has no ratio without three weeks of history', () => {
    const sessions = [makeSession({ id: 'a', finishedAt: day(2), exercises: [{ exerciseId: 'exercise-1', sets: hard(10) }] })]
    const result = computeTrainingLoad(sessions, exercises, NOW)
    expect(result.ratio).toBeNull()
    expect(result.acuteSets).toBe(10)
    expect(result.lastSessionDaysAgo).toBe(2)
  })

  it('computes acute vs chronic hard sets, ignoring warm-ups and unfinished sessions', () => {
    const sessions = [
      makeSession({ id: 'old', finishedAt: day(25), exercises: [{ exerciseId: 'exercise-1', sets: hard(10) }] }),
      makeSession({ id: 'mid', finishedAt: day(14), exercises: [{ exerciseId: 'exercise-1', sets: hard(10) }] }),
      makeSession({ id: 'new', finishedAt: day(1), exercises: [{ exerciseId: 'exercise-1', sets: [...hard(20), ...hard(5, 'warmup')] }] }),
      makeSession({ id: 'open', finishedAt: null, exercises: [{ exerciseId: 'exercise-1', sets: hard(50) }] }),
    ]
    const result = computeTrainingLoad(sessions, exercises, NOW)
    expect(result.acuteSets).toBe(20)
    expect(result.chronicWeeklySets).toBe(10)
    expect(result.ratio).toBe(2)
    expect(result.muscles[0]).toMatchObject({ muscle: 'Peitoral', daysSince: 1, sets: 20 })
  })
})

describe('load adjustment', () => {
  it('maps levels to multipliers and set changes', () => {
    expect(loadAdjustmentFor('normal')).toMatchObject({ multiplier: 1, setDelta: 0, message: null })
    expect(loadAdjustmentFor('moderado')).toMatchObject({ multiplier: 0.95, setDelta: 0 })
    expect(loadAdjustmentFor('leve').message).toContain('Prontidão baixa: sugerimos −10% de carga hoje')
    expect(loadAdjustmentFor('descanso').setDelta).toBe(-1)
    expect(readinessLoadAdjustment(null).multiplier).toBe(1)
    expect(recommendationForScore(65)).toBe('normal')
    expect(recommendationForScore(39)).toBe('descanso')
  })

  it('rounds adjusted weights to usable steps and always lowers them', () => {
    expect(adjustWeight(100, 0.9)).toBe(90)
    expect(adjustWeight(82.5, 0.95)).toBe(77.5)
    expect(adjustWeight(20, 0.95)).toBe(17.5)
    expect(adjustWeight(12, 0.9)).toBe(11)
    expect(adjustWeight(1, 0.9)).toBe(0)
    expect(adjustWeight(0, 0.9)).toBe(0)
    expect(adjustWeight(60, 1)).toBe(60)
  })

  it('adjusts a progression suggestion without touching it when normal', () => {
    const suggestion = { weight: 80, reason: 'Faixa concluida', progressed: true }
    expect(applyReadinessToSuggestion(suggestion, null)).toBe(suggestion)
    expect(applyReadinessToSuggestion(suggestion, loadAdjustmentFor('normal'))).toBe(suggestion)
    const adjusted = applyReadinessToSuggestion(suggestion, loadAdjustmentFor('leve'))!
    expect(adjusted.weight).toBe(72.5)
    expect(adjusted.readinessAdjusted).toBe(true)
    expect(adjusted.reason).toContain('seria 80 kg')
    expect(suggestion.weight).toBe(80)
  })
})
