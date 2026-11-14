import { differenceInCalendarDays } from 'date-fns'

export interface ReadinessInput {
  hrv: Array<{ date: Date; value: number }>
  restingHr: Array<{ date: Date; value: number }>
  /** Last night, if any. */
  sleep: { asleep: number; deep: number; rem: number; hasStages: boolean; end: Date } | null
  /** Hard sets logged in the last 24 hours. */
  recentSets: number
  now?: Date
}

export interface ReadinessComponent {
  key: 'hrv' | 'rhr' | 'sleep' | 'load'
  label: string
  score: number
  detail: string
}

export interface Readiness {
  score: number
  level: 'high' | 'normal' | 'low'
  headline: string
  advice: string
  components: ReadinessComponent[]
}

const SLEEP_TARGET_MIN = 450

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

/**
 * 0–100 readiness from HRV and resting heart rate vs. personal baseline, last
 * night's sleep and yesterday's training load. Missing inputs are skipped and the
 * remaining weights re-normalised. Null when there is nothing to judge.
 */
export function computeReadiness(input: ReadinessInput): Readiness | null {
  const now = input.now ?? new Date()
  const components: Array<ReadinessComponent & { weight: number }> = []

  const hrv = versusBaseline(input.hrv, now)
  if (hrv) {
    components.push({
      key: 'hrv', label: 'Variabilidade cardíaca', weight: 0.35,
      score: clamp(60 + hrv.z * 20),
      detail: `${Math.round(hrv.latest)} ms · média ${Math.round(hrv.mean)} ms`,
    })
  }

  const rhr = versusBaseline(input.restingHr, now)
  if (rhr) {
    components.push({
      key: 'rhr', label: 'FC em repouso', weight: 0.25,
      // A resting heart rate above baseline signals fatigue or illness.
      score: clamp(60 - rhr.z * 20),
      detail: `${Math.round(rhr.latest)} bpm · média ${Math.round(rhr.mean)} bpm`,
    })
  }

  if (input.sleep && differenceInCalendarDays(now, input.sleep.end) <= 0) {
    const { asleep, deep, rem, hasStages } = input.sleep
    let score = clamp((asleep / SLEEP_TARGET_MIN) * 100)
    if (hasStages && asleep > 0 && (deep + rem) / asleep < 0.25) score = clamp(score - 12)
    const hours = Math.floor(asleep / 60)
    components.push({
      key: 'sleep', label: 'Sono', weight: 0.3, score,
      detail: `${hours}h ${String(asleep % 60).padStart(2, '0')} dormidas`,
    })
  }

  if (components.length === 0) return null

  components.push({
    key: 'load', label: 'Carga recente', weight: 0.1,
    score: input.recentSets >= 25 ? 40 : input.recentSets >= 15 ? 65 : 90,
    detail: input.recentSets > 0 ? `${input.recentSets} séries nas últimas 24 h` : 'Sem treino nas últimas 24 h',
  })

  const totalWeight = components.reduce((total, item) => total + item.weight, 0)
  const score = Math.round(components.reduce((total, item) => total + item.score * item.weight, 0) / totalWeight)
  const level = score >= 75 ? 'high' : score >= 55 ? 'normal' : 'low'
  return {
    score,
    level,
    headline: level === 'high' ? 'Pronto para treinar pesado.' : level === 'normal' ? 'Bom para um treino normal.' : 'Dia de pegar leve.',
    advice: level === 'high'
      ? 'Seu corpo se recuperou bem. Bom dia para buscar recordes.'
      : level === 'normal'
        ? 'Siga o plano, sem forçar além do previsto.'
        : 'Reduza a carga ou faça cardio leve e mobilidade. Recuperar também é treino.',
    components: components.map(({ key, label, score: value, detail }) => ({ key, label, score: value, detail })),
  }
}
