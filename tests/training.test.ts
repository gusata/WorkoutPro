import { describe, expect, it } from 'vitest'
import { calculatePlates, comparePeriods, exerciseMatches, getProgressionSuggestion } from '@/lib/training'

describe('training helpers', () => {
  it('suggests load only after every work set reaches the range', () => {
    expect(getProgressionSuggestion([
      { weight: 80, reps: 10, rir: 2, setType: 'normal' },
      { weight: 80, reps: 10, rir: 1, setType: 'normal' },
      { weight: 40, reps: 10, rir: null, setType: 'warmup' },
    ], 10)?.weight).toBe(82.5)
    expect(getProgressionSuggestion([{ weight: 80, reps: 8, rir: 2 }], 10)?.progressed).toBe(false)
  })

  it('calculates plates per side without exceeding the requested load', () => {
    expect(calculatePlates(100)).toEqual({ perSide: [{ plate: 25, perSide: 1 }, { plate: 15, perSide: 1 }], actualWeight: 100, remainder: 0 })
  })

  it('matches accents, words and compact fuzzy queries', () => {
    expect(exerciseMatches('Elevação lateral', 'elev lat')).toBe(true)
    expect(exerciseMatches('Supino reto', 'sprt')).toBe(true)
    expect(exerciseMatches('Agachamento livre', 'rosca')).toBe(false)
  })

  it('compares periods safely', () => {
    expect(comparePeriods(120, 100)).toBe(20)
    expect(comparePeriods(10, 0)).toBe(100)
  })
})
