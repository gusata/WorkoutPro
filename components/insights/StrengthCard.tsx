'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { LineChart } from '@/components/insights/LineChart'
import { getExerciseHistory } from '@/lib/exerciseHistory'
import { trendPer30Days } from '@/lib/insights'
import { formatDecimal } from '@/lib/utils'
import type { Exercise, Workout, WorkoutSession } from '@/types'

function round1(value: number) {
  return Math.round(value * 10) / 10
}

/** Estimated-1RM line for one exercise with a least-squares trend. */
export function StrengthChart({ exerciseId, sessions, workouts }: { exerciseId: string; sessions: WorkoutSession[]; workouts: Workout[] }) {
  const history = useMemo(() => getExerciseHistory(exerciseId, sessions, workouts).slice().reverse(), [exerciseId, sessions, workouts])
  const points = history.filter((entry) => entry.bestEstimatedOneRm > 0).map((entry) => ({ date: entry.date, value: round1(entry.bestEstimatedOneRm) }))
  const slope = trendPer30Days(points)
  if (points.length === 0) {
    return <p className="subhead py-6 text-center text-[var(--muted)]">Finalize um treino com este exercício para ver a curva de força.</p>
  }
  // The least-squares line passes through the mean point.
  const xs = points.map((point) => (point.date.getTime() - points[0].date.getTime()) / 86_400_000)
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length
  const meanY = points.reduce((total, point) => total + point.value, 0) / points.length
  const fit = (dayOffset: number) => meanY + ((slope ?? 0) / 30) * (dayOffset - meanX)
  const best = Math.max(...points.map((point) => point.value))
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="subhead text-[var(--muted)]">1RM estimado</p>
          <p className="stat text-[40px]">{formatDecimal(points.at(-1)!.value)}<span className="stat-unit">kg</span></p>
        </div>
        <div className="text-right">
          <p className="subhead text-[var(--muted)]">Tendência</p>
          <p className={`headline ${slope == null ? '' : slope >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
            {slope == null ? '—' : `${slope >= 0 ? '+' : ''}${formatDecimal(round1(slope))} kg/mês`}
          </p>
        </div>
      </div>
      <div className="mt-5">
        <LineChart
          points={points}
          trend={slope != null ? { from: fit(0), to: fit(xs.at(-1)!) } : null}
          format={(value) => `${formatDecimal(value)} kg`}
          label={`1RM estimado em ${points.length} sessões, de ${formatDecimal(points[0].value)} kg a ${formatDecimal(points.at(-1)!.value)} kg. Melhor: ${formatDecimal(best)} kg.`}
        />
      </div>
      <p className="footnote mt-3 text-[var(--muted)]">Melhor marca: {formatDecimal(best)} kg · fórmula de Epley.</p>
    </div>
  )
}

/** Picker of trained exercises + chart, used on the Progress tab. */
export function StrengthCard({ exercises, sessions, workouts }: { exercises: Exercise[]; sessions: WorkoutSession[]; workouts: Workout[] }) {
  const trained = useMemo(() => {
    const counts = new Map<string, number>()
    for (const session of sessions) {
      if (!session.finishedAt) continue
      for (const item of session.exercises) if (item.sets.length) counts.set(item.exerciseId, (counts.get(item.exerciseId) ?? 0) + 1)
    }
    return exercises.filter((exercise) => counts.has(exercise.id)).sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
  }, [exercises, sessions])
  const [selected, setSelected] = useState<string | null>(null)
  const exerciseId = selected && trained.some((item) => item.id === selected) ? selected : trained[0]?.id

  if (!exerciseId) {
    return <div className="tile"><p className="subhead text-center text-[var(--muted)]">Seus gráficos de força aparecem depois do primeiro treino.</p></div>
  }

  return (
    <div className="tile">
      <div className="scroll-row -mt-1 mb-6 !mx-[-24px] !px-6" role="group" aria-label="Exercício do gráfico">
        {trained.slice(0, 12).map((exercise) => (
          <button key={exercise.id} type="button" aria-pressed={exercise.id === exerciseId} onClick={() => setSelected(exercise.id)} className="chip">
            {exercise.name}
          </button>
        ))}
      </div>
      <StrengthChart exerciseId={exerciseId} sessions={sessions} workouts={workouts} />
      <Link href={`/exercises/detail?id=${exerciseId}`} className="link mt-1 text-[17px]">Histórico completo<ChevronRight size={17} aria-hidden /></Link>
    </div>
  )
}
