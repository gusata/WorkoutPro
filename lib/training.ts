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

export interface WarmupOptions {
  /** Barbell lifts start with the empty bar and are rounded to loadable plates. */
  barbell?: boolean
  /** Isolation exercises need fewer ramp-up sets. */
  isolation?: boolean
  availablePlates?: number[]
}

/** Heaviest load not above `weight` that the plate set can build on the bar (reuses the plate calculator). */
export function roundToPlates(weight: number, barWeight = 20, availablePlates?: number[]) {
  if (weight <= barWeight) return barWeight
  return calculatePlates(weight + 1e-6, barWeight, availablePlates).actualWeight
}

/**
 * Ramp-up sets before the first working weight.
 * Barbell compound: bar x10, 40% x8, 60% x5, 80% x3 (fewer steps for light loads).
 * Isolation: one or two light sets. Barbell loads are rounded to available plates,
 * other loads to 2.5 kg. Steps at or above the working weight are dropped.
 */
export function generateWarmupSets(workWeight: number, barWeight = 20, options: WarmupOptions = {}): WarmupStep[] {
  const barbell = options.barbell ?? true
  const isolation = options.isolation ?? false
  if (!(workWeight > 0)) return []
  let scheme: Array<[number | 'bar', number]>
  if (isolation) {
    scheme = workWeight >= 40 ? [[0.5, 10], [0.75, 5]] : workWeight >= 10 ? [[0.5, 10]] : []
  } else if (barbell) {
    scheme = workWeight >= barWeight * 2.5
      ? [['bar', 10], [0.4, 8], [0.6, 5], [0.8, 3]]
      : workWeight >= barWeight * 1.5
        ? [['bar', 10], [0.7, 5]]
        : [['bar', 10]]
  } else {
    scheme = workWeight >= 40
      ? [[0.4, 8], [0.6, 5], [0.8, 3]]
      : workWeight >= 15 ? [[0.5, 8], [0.75, 4]] : workWeight >= 5 ? [[0.5, 10]] : []
  }
  const steps: WarmupStep[] = []
  for (const [pct, reps] of scheme) {
    const raw = pct === 'bar' ? barWeight : workWeight * pct
    const weight = barbell
      ? Math.max(barWeight, roundToPlates(raw, barWeight, options.availablePlates))
      : Math.max(2.5, roundTo(raw, 2.5))
    if (weight >= workWeight) continue
    if (steps.some((step) => step.weight === weight)) continue
    steps.push({ weight, reps })
  }
  return steps
}

function hasAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word))
}

const ISOLATION_WORDS = [
  'rosca', 'extensora', 'flexora', 'elevacao lateral', 'elevacao frontal', 'panturrilha', 'pulley', 'triceps', 'crucifixo',
  'face pull', 'peck deck', 'crossover', 'voador', 'prancha', 'abdominal', 'abducao', 'aducao', 'encolhimento', 'kickback',
]
const BARBELL_WORDS = ['agachamento livre', 'agachamento', 'supino reto', 'supino inclinado', 'levantamento terra', 'terra', 'stiff', 'remada curvada', 'desenvolvimento militar', 'hip thrust']
const NOT_BARBELL_WORDS = ['halter', 'maquina', 'smith', 'cabo', 'polia', 'goblet', 'leg press', 'hack', 'kettlebell', 'elastico', 'peso corporal']

/** Heuristic used for warm-ups when the exercise has no explicit equipment/mechanic data. */
export function classifyExercise(name: string, equipment?: string): { barbell: boolean; isolation: boolean } {
  const text = normalized(`${name} ${equipment ?? ''}`)
  const eq = normalized(equipment ?? '')
  const isolation = hasAny(text, ISOLATION_WORDS)
  const barbell = eq
    ? /\bbarra\b|barbell|olimpic/.test(eq) && !hasAny(eq, ['fixa'])
    : hasAny(text, BARBELL_WORDS) && !hasAny(text, NOT_BARBELL_WORDS)
  return { barbell, isolation }
}
