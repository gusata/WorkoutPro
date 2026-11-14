import { differenceInCalendarDays } from 'date-fns'
import { isHardSet, lastHardSessionByMuscle, type MuscleOptions, type MuscleRecency } from '@/lib/muscleVolume'
import type { ProgressionSuggestion } from '@/lib/training'
import type { Exercise, WorkoutSession } from '@/types'

/** Training load from logged sessions (hard sets, warm-ups excluded). */
export interface TrainingLoad {
  /** Hard sets in the last 7 days. */
  acuteSets: number
  /** Average hard sets per week over the last 28 days (includes the acute week). */
  chronicWeeklySets: number
  /** Acute:chronic workload ratio; null while there are fewer than 3 weeks of history. */
  ratio: number | null
  /** Calendar days since the last finished session, null when there is none. */
  lastSessionDaysAgo: number | null
  /** Most recent hard session per muscle (last 14 days), freshest first. */
  muscles: MuscleRecency[]
}

export interface ReadinessInput {
  hrv: Array<{ date: Date; value: number }>
  restingHr: Array<{ date: Date; value: number }>
  /** Last night, if any. */
  sleep: { asleep: number; deep: number; rem: number; hasStages: boolean; end: Date } | null
  /** Hard sets logged in the last 24 hours. */
  recentSets: number
  /** Optional training-load picture (see computeTrainingLoad). */
  training?: TrainingLoad | null
  now?: Date
}

export interface ReadinessComponent {
  key: 'hrv' | 'rhr' | 'sleep' | 'load' | 'acwr'
  label: string
  score: number
  detail: string
}

export type RecommendationLevel = 'normal' | 'moderado' | 'leve' | 'descanso'

export interface ReadinessReason {
  text: string
  tone: 'positive' | 'neutral' | 'negative'
}

export interface Recommendation {
  level: RecommendationLevel
  /** "Treino normal", "Treino moderado"... */
  label: string
  reasons: ReadinessReason[]
}

export interface Readiness {
  score: number
  level: 'high' | 'normal' | 'low'
  headline: string
  advice: string
  components: ReadinessComponent[]
  recommendation: Recommendation
  /** 'training' when no watch data was available and only logged sessions were used. */
  basis: 'full' | 'training'
}

const SLEEP_TARGET_MIN = 450
const DAY_MS = 86_400_000

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function stats(values: number[]) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length
  return { mean, sd: Math.max(Math.sqrt(variance), mean * 0.03, 0.5) }
}

/** Latest value (from the last 2 days) compared with the 30 days before it. */
function versusBaseline(series: Array<{ date: Date; value: number }>, now: Date) {
  if (series.length < 4) return null
  const latest = series[series.length - 1]
  if (differenceInCalendarDays(now, latest.date) > 1) return null
  const baseline = series.slice(0, -1).filter((item) => differenceInCalendarDays(latest.date, item.date) <= 30)
  if (baseline.length < 3) return null
  const { mean, sd } = stats(baseline.map((item) => item.value))
  return { latest: latest.value, mean, z: (latest.value - mean) / sd }
}

function hardSets(session: WorkoutSession) {
  return session.exercises.reduce((total, item) => total + item.sets.filter(isHardSet).length, 0)
}

/**
 * Acute (7 days) vs chronic (28 days, as a weekly average) hard-set load, plus how
 * recently each muscle had a hard session. The ratio needs 3+ weeks of history and
 * a chronic base of at least 4 sets/week, otherwise it is null.
 */
export function computeTrainingLoad(
  sessions: WorkoutSession[],
  exercises: Exercise[],
  now: Date = new Date(),
  options: MuscleOptions = {}
): TrainingLoad {
  let acute = 0
  let chronic = 0
  let earliest: Date | null = null
  let latest: Date | null = null
  for (const session of sessions) {
    if (!session.finishedAt) continue
    const date = new Date(session.finishedAt)
    if (date > now) continue
    if (!earliest || date < earliest) earliest = date
    if (!latest || date > latest) latest = date
    const age = (now.getTime() - date.getTime()) / DAY_MS
    if (age > 28) continue
    const sets = hardSets(session)
    chronic += sets
    if (age <= 7) acute += sets
  }
  const chronicWeeklySets = chronic / 4
  const enoughHistory = earliest != null && differenceInCalendarDays(now, earliest) >= 21
  return {
    acuteSets: acute,
    chronicWeeklySets,
    ratio: enoughHistory && chronicWeeklySets >= 4 ? acute / chronicWeeklySets : null,
    lastSessionDaysAgo: latest ? differenceInCalendarDays(now, latest) : null,
    muscles: lastHardSessionByMuscle(sessions.filter((session) => session.finishedAt), exercises, now, 14, options),
  }
}

function formatRatio(ratio: number) {
  return (Math.round(ratio * 10) / 10).toFixed(1).replace('.', ',')
}

function formatHours(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${String(Math.round(minutes % 60)).padStart(2, '0')}`
}

const LEVEL_ORDER: RecommendationLevel[] = ['normal', 'moderado', 'leve', 'descanso']
const LEVEL_LABEL: Record<RecommendationLevel, string> = {
  normal: 'Treino normal',
  moderado: 'Treino moderado',
  leve: 'Treino leve',
  descanso: 'Descanso',
}

function atLeast(level: RecommendationLevel, floor: RecommendationLevel) {
  return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(floor) ? level : floor
}

export function recommendationForScore(score: number): RecommendationLevel {
  if (score >= 65) return 'normal'
  if (score >= 55) return 'moderado'
  if (score >= 40) return 'leve'
  return 'descanso'
}

/**
 * 0–100 readiness from HRV and resting heart rate vs. personal baseline, last
 * night's sleep, yesterday's sets and (optionally) the acute:chronic training load.
 * Missing inputs are skipped and the remaining weights re-normalised. Null when
 * there is nothing to judge (no watch data and not enough training history).
 */
export function computeReadiness(input: ReadinessInput): Readiness | null {
  const now = input.now ?? new Date()
  const components: Array<ReadinessComponent & { weight: number }> = []
  const reasons: Array<ReadinessReason & { score: number }> = []
  let floor: RecommendationLevel = 'normal'

  const hrv = versusBaseline(input.hrv, now)
  if (hrv) {
    const score = clamp(60 + hrv.z * 20)
    components.push({
      key: 'hrv', label: 'Variabilidade cardíaca', weight: 0.35, score,
      detail: `${Math.round(hrv.latest)} ms · média ${Math.round(hrv.mean)} ms`,
    })
    const pct = Math.round(Math.abs((hrv.latest - hrv.mean) / hrv.mean) * 100)
    reasons.push(hrv.z <= -1
      ? { text: `HRV ${pct}% abaixo da sua média`, tone: 'negative', score }
      : hrv.z >= 1
        ? { text: `HRV ${pct}% acima da sua média`, tone: 'positive', score }
        : { text: 'HRV dentro da sua média', tone: 'neutral', score })
  }

  const rhr = versusBaseline(input.restingHr, now)
  if (rhr) {
    // A resting heart rate above baseline signals fatigue or illness.
    const score = clamp(60 - rhr.z * 20)
    components.push({
      key: 'rhr', label: 'FC em repouso', weight: 0.25, score,
      detail: `${Math.round(rhr.latest)} bpm · média ${Math.round(rhr.mean)} bpm`,
    })
    const diff = Math.round(Math.abs(rhr.latest - rhr.mean))
    reasons.push(rhr.z >= 1
      ? { text: `FC em repouso ${diff} bpm acima da média`, tone: 'negative', score }
      : rhr.z <= -1
        ? { text: `FC em repouso ${diff} bpm abaixo da média`, tone: 'positive', score }
        : { text: 'FC em repouso normal', tone: 'neutral', score })
  }

  if (input.sleep && differenceInCalendarDays(now, input.sleep.end) <= 0) {
    const { asleep, deep, rem, hasStages } = input.sleep
    let score = clamp((asleep / SLEEP_TARGET_MIN) * 100)
    const poorStages = hasStages && asleep > 0 && (deep + rem) / asleep < 0.25
    if (poorStages) score = clamp(score - 12)
    components.push({
      key: 'sleep', label: 'Sono', weight: 0.3, score,
      detail: `${formatHours(asleep)} dormidas`,
    })
    if (asleep < 300) floor = atLeast(floor, 'moderado')
    reasons.push(asleep < 360
      ? { text: `Sono curto: ${formatHours(asleep)}`, tone: 'negative', score }
      : poorStages
        ? { text: 'Pouco sono profundo e REM', tone: 'negative', score }
        : asleep >= 420
          ? { text: `Boa noite de sono: ${formatHours(asleep)}`, tone: 'positive', score }
          : { text: `Sono razoável: ${formatHours(asleep)}`, tone: 'neutral', score })
  }

  const physiological = components.length
  const ratio = input.training?.ratio ?? null
  if (physiological === 0 && ratio == null) return null

  const loadScore = input.recentSets >= 25 ? 40 : input.recentSets >= 15 ? 65 : 90
  components.push({
    key: 'load', label: 'Carga recente', weight: 0.1, score: loadScore,
    detail: input.recentSets > 0 ? `${input.recentSets} séries nas últimas 24 h` : 'Sem treino nas últimas 24 h',
  })
  if (input.recentSets >= 15) reasons.push({ text: `${input.recentSets} séries nas últimas 24 h`, tone: 'negative', score: loadScore })

  if (ratio != null) {
    const score = ratio > 1.5 ? 35 : ratio > 1.3 ? 60 : ratio < 0.8 ? 85 : 90
    components.push({
      key: 'acwr', label: 'Carga da semana', weight: 0.2, score,
      detail: `${Math.round(input.training!.acuteSets)} séries em 7 dias · média ${Math.round(input.training!.chronicWeeklySets)}/semana`,
    })
    if (ratio > 1.5) floor = atLeast(floor, 'moderado')
    reasons.push(ratio > 1.3
      ? { text: `Carga dos últimos 7 dias ${formatRatio(ratio)}× a sua média de 4 semanas`, tone: 'negative', score }
      : ratio < 0.8
        ? { text: 'Semana mais leve que o habitual', tone: 'positive', score }
        : { text: 'Carga da semana dentro do habitual', tone: 'neutral', score })
  }

  const sore = (input.training?.muscles ?? []).filter((item) => item.daysSince <= 1 && item.sets >= 6)
  if (sore.length > 0) {
    reasons.push({
      text: `Ainda recuperando: ${sore.slice(0, 3).map((item) => `${item.muscle} (${item.daysSince === 0 ? 'hoje' : 'ontem'}, ${Math.round(item.sets)} séries)`).join(', ')}`,
      tone: 'neutral',
      score: 70,
    })
  }

  const totalWeight = components.reduce((total, item) => total + item.weight, 0)
  const score = Math.round(components.reduce((total, item) => total + item.score * item.weight, 0) / totalWeight)
  const level = score >= 75 ? 'high' : score >= 55 ? 'normal' : 'low'
  const recommendationLevel = atLeast(recommendationForScore(score), floor)

  const negatives = reasons.filter((reason) => reason.tone === 'negative').sort((a, b) => a.score - b.score)
  const others = reasons.filter((reason) => reason.tone !== 'negative').sort((a, b) => (a.tone === 'positive' ? -1 : 1) - (b.tone === 'positive' ? -1 : 1))
  const ordered = recommendationLevel === 'normal' ? [...others, ...negatives] : [...negatives, ...others]

  const headline = recommendationLevel === 'normal'
    ? level === 'high' ? 'Pronto para treinar pesado.' : 'Bom para um treino normal.'
    : recommendationLevel === 'moderado' ? 'Treino moderado hoje.'
      : recommendationLevel === 'leve' ? 'Dia de pegar leve.' : 'Dia de descanso.'
  const advice = recommendationLevel === 'normal'
    ? level === 'high' ? 'Seu corpo se recuperou bem. Bom dia para buscar recordes.' : 'Siga o plano, sem forçar além do previsto.'
    : recommendationLevel === 'moderado'
      ? 'Siga o plano com um pouco menos de carga e sem ir à falha.'
      : recommendationLevel === 'leve'
        ? 'Reduza a carga e uma série por exercício, ou faça cardio leve e mobilidade. Recuperar também é treino.'
        : 'Descanse ou faça só mobilidade e caminhada. Se treinar, vá bem leve.'

  return {
    score,
    level,
    headline,
    advice,
    components: components.map(({ key, label, score: value, detail }) => ({ key, label, score: value, detail })),
    recommendation: {
      level: recommendationLevel,
      label: LEVEL_LABEL[recommendationLevel],
      reasons: ordered.slice(0, 4).map(({ text, tone }) => ({ text, tone })),
    },
    basis: physiological > 0 ? 'full' : 'training',
  }
}

// ---------------------------------------------------------------------------
// Load adjustment for the workout
// ---------------------------------------------------------------------------

export interface LoadAdjustment {
  level: RecommendationLevel
  /** Multiply the suggested working weight by this. */
  multiplier: number
  /** Add this to the planned number of working sets (0 or negative). */
  setDelta: number
  /** Short note to show during the workout; null when nothing changes. */
  message: string | null
}

const ADJUSTMENTS: Record<RecommendationLevel, Omit<LoadAdjustment, 'level' | 'message'>> = {
  normal: { multiplier: 1, setDelta: 0 },
  moderado: { multiplier: 0.95, setDelta: 0 },
  leve: { multiplier: 0.9, setDelta: -1 },
  descanso: { multiplier: 0.85, setDelta: -1 },
}

export function loadAdjustmentFor(level: RecommendationLevel): LoadAdjustment {
  const { multiplier, setDelta } = ADJUSTMENTS[level]
  const pct = Math.round((1 - multiplier) * 100)
  const sets = setDelta < 0 ? ' e uma série a menos por exercício' : ''
  const message = level === 'normal'
    ? null
    : level === 'moderado'
      ? `Prontidão moderada: sugerimos −${pct}% de carga hoje.`
      : level === 'leve'
        ? `Prontidão baixa: sugerimos −${pct}% de carga hoje${sets}.`
        : `Prontidão muito baixa: o ideal é descansar. Se treinar, sugerimos −${pct}% de carga${sets}.`
  return { level, multiplier, setDelta, message }
}

/** Suggested load change for today's workout; no readiness means no change. */
export function readinessLoadAdjustment(readiness: Readiness | null | undefined): LoadAdjustment {
  return loadAdjustmentFor(readiness?.recommendation.level ?? 'normal')
}

/**
 * Applies a multiplier to a suggested weight, rounded to plate-friendly steps
 * (2.5 kg from 20 kg up, 1 kg below). A reduction always lowers the weight by at
 * least one step, never below zero.
 */
export function adjustWeight(weight: number, multiplier: number): number {
  if (!(weight > 0) || multiplier >= 1) return weight
  const step = weight >= 20 ? 2.5 : 1
  let adjusted = Math.round((weight * multiplier) / step) * step
  if (adjusted >= weight) adjusted = weight - step
  return Math.max(0, Math.round(adjusted * 100) / 100)
}

export type AdjustedSuggestion = ProgressionSuggestion & { readinessAdjusted?: boolean }

/** A progression suggestion with the readiness multiplier applied; unchanged when there is nothing to adjust. */
export function applyReadinessToSuggestion(suggestion: ProgressionSuggestion | null, adjustment: LoadAdjustment | null): AdjustedSuggestion | null {
  if (!suggestion || !adjustment || adjustment.multiplier >= 1) return suggestion
  const weight = adjustWeight(suggestion.weight, adjustment.multiplier)
  if (weight === suggestion.weight) return suggestion
  const pct = Math.round((1 - adjustment.multiplier) * 100)
  const sets = adjustment.setDelta < 0 ? ` e ${Math.abs(adjustment.setDelta)} série a menos` : ''
  return {
    weight,
    progressed: false,
    readinessAdjusted: true,
    reason: `−${pct}% pela prontidão de hoje${sets} (seria ${String(suggestion.weight).replace('.', ',')} kg).`,
  }
}
