import type { CompletedSet, ProgressionRule, SetType } from '@/types'

export const SET_TYPES: Array<{ value: SetType; label: string; shortLabel: string }> = [
  { value: 'warmup', label: 'Aquecimento', shortLabel: 'A' },
  { value: 'normal', label: 'Trabalho', shortLabel: 'N' },
  { value: 'drop', label: 'Drop set', shortLabel: 'D' },
  { value: 'failure', label: 'Falha', shortLabel: 'F' },
  { value: 'amrap', label: 'AMRAP', shortLabel: 'M' },
]

export const DEFAULT_PROGRESSION: ProgressionRule = {
  type: 'double-progression',
  increment: 2.5,
  minimumRir: 1,
}

export interface ProgressionSuggestion {
  weight: number
  reason: string
  progressed: boolean
}

export function getProgressionSuggestion(
  sets: Array<Pick<CompletedSet, 'weight' | 'reps' | 'rir' | 'setType'>>,
  maxReps: number,
  rule: ProgressionRule = DEFAULT_PROGRESSION
): ProgressionSuggestion | null {
  const workSets = sets.filter((set) => (set.setType ?? 'normal') !== 'warmup')
  if (workSets.length === 0) return null
  const baseWeight = Math.max(...workSets.map((set) => set.weight))
  const eligible = workSets.every(
    (set) => set.reps >= maxReps && (set.rir == null || set.rir >= rule.minimumRir)
  )
  return eligible
    ? { weight: baseWeight + rule.increment, progressed: true, reason: `Faixa concluida: suba ${rule.increment} kg.` }
    : { weight: baseWeight, progressed: false, reason: `Mantenha a carga ate completar ${maxReps} repeticoes com ${rule.minimumRir}+ RIR.` }
}

export interface PlateLoad {
  plate: number
  perSide: number
}

export function calculatePlates(
  totalWeight: number,
  barWeight = 20,
  availablePlates = [25, 20, 15, 10, 5, 2.5, 1.25]
): { perSide: PlateLoad[]; actualWeight: number; remainder: number } {
  let remaining = Math.max(0, (totalWeight - barWeight) / 2)
  const perSide: PlateLoad[] = []
  for (const plate of [...availablePlates].sort((a, b) => b - a)) {
    const count = Math.floor((remaining + 1e-9) / plate)
    if (count > 0) {
      perSide.push({ plate, perSide: count })
      remaining -= plate * count
    }
  }
  const loadedPerSide = perSide.reduce((sum, item) => sum + item.plate * item.perSide, 0)
  return {
    perSide,
    actualWeight: barWeight + loadedPerSide * 2,
    remainder: Math.round(remaining * 200) / 100,
  }
}

function normalized(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export function exerciseMatches(name: string, query: string) {
  const target = normalized(name)
  const terms = normalized(query).split(/\s+/).filter(Boolean)
  return terms.length === 0 || terms.every((term) => target.includes(term) || isSubsequence(term, target))
}

function isSubsequence(needle: string, haystack: string) {
  let cursor = 0
  for (const character of haystack) if (character === needle[cursor]) cursor += 1
  return cursor === needle.length
}

export function comparePeriods(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

export interface WarmupStep {
  weight: number
  reps: number
}

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step
}

/**
 * Ramp-up sets before a working weight: ~40% x 10, 60% x 5, 80% x 3 (lighter loads
 * get fewer steps). Weights are rounded to 2.5 kg and never go below the empty bar.
 */
export function generateWarmupSets(workWeight: number, barWeight = 20): WarmupStep[] {
  if (workWeight <= 0) return []
  const scheme = workWeight >= barWeight * 3
    ? [[0.4, 10], [0.6, 5], [0.8, 3]]
    : workWeight > barWeight * 1.5
      ? [[0.5, 8], [0.75, 4]]
      : [[0.5, 10]]
  const steps: WarmupStep[] = []
  for (const [pct, reps] of scheme) {
    const weight = Math.max(barWeight > workWeight ? 0 : barWeight, roundTo(workWeight * pct, 2.5))
    if (weight >= workWeight) continue
    if (steps.some((step) => step.weight === weight)) continue
    steps.push({ weight, reps })
  }
  return steps
}
