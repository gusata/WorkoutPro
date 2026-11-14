import { describe, expect, it } from 'vitest'
import { getExerciseCandidates, LIBRARY_CANDIDATES, normalizeExerciseName } from '@/lib/exerciseCandidates'
import { LIBRARY } from '@/lib/exerciseLibrary'

describe('routine generator candidates from the exercise library', () => {
  it('maps every library entry to a candidate with a valid equipment and mechanic', () => {
    expect(LIBRARY_CANDIDATES).toHaveLength(LIBRARY.length)
    expect(LIBRARY_CANDIDATES.find((item) => item.name === LIBRARY.find((entry) => entry.equipment === 'polia')!.name)?.equipment).toBe('cabo')
    for (const item of LIBRARY_CANDIDATES) expect(['compound', 'isolation']).toContain(item.mechanic)
  })

  it('offers library exercises without duplicating names', () => {
    const candidates = getExerciseCandidates([])
    const names = candidates.map((item) => normalizeExerciseName(item.name))
    expect(new Set(names).size).toBe(names.length)
    expect(candidates.length).toBeGreaterThanOrEqual(LIBRARY.length)
    expect(candidates.some((item) => item.equipment === 'kettlebell')).toBe(true)
  })
})
