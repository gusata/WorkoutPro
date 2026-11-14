'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, Play, Plus } from 'lucide-react'
import { addDays, differenceInCalendarDays, endOfWeek, format, isSameDay, isWithinInterval, startOfMonth, startOfWeek, subDays, subMonths, subWeeks } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useProfileStore } from '@/stores/useProfileStore'
import { useSessionStore } from '@/stores/useSessionStore'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { useCardioStore } from '@/stores/useCardioStore'
import { useHealthStore } from '@/stores/useHealthStore'
import { ScoreRing } from '@/components/health/charts'
import { HeartRateChip } from '@/components/health/HeartRateCard'
import { useLiveHealth } from '@/components/health/useLiveHealth'
import { useTodayReadiness } from '@/components/health/useReadiness'
import { cardioMinutesInWeek, DEFAULT_CARDIO_GOAL } from '@/lib/cardio'
import { buttonClasses } from '@/components/ui/Button'
import { Hero, LocalNav, SectionHeader } from '@/components/layout/PageHeader'
import { MuscleMap } from '@/components/insights/MuscleMap'
import { formatDate, formatDecimal, formatVolume } from '@/lib/utils'
import { getEffectiveGoals, getBlockProgress } from '@/lib/preferences'
import { getDeloadAdvice, muscleSetsInRange } from '@/lib/insights'
import { getMuscleTargets, lateWeekNudge, weeklyMuscleReport } from '@/lib/muscleVolume'
import { reminderMessage, workoutsForWeekday } from '@/lib/reminders'
import type { Exercise, Workout, WorkoutSession } from '@/types'

const WEEK_DAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']
const WEEK_DAY_NAMES = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo']

function finishedAt(session: WorkoutSession | null | undefined) {
  return session?.finishedAt ? new Date(session.finishedAt) : null
}

function setCount(session: WorkoutSession) {
  return session.exercises.reduce((total, item) => total + item.sets.length, 0)
}

function lastSessionByWorkout(sessions: WorkoutSession[]) {
  const map = new Map<string, WorkoutSession>()
  for (const session of sessions) {
    const date = finishedAt(session)
    if (!date) continue
    const current = finishedAt(map.get(session.workoutId))
    if (!current || date > current) map.set(session.workoutId, session)
  }
  return map
}

function daysAgoLabel(date: Date | null) {
  if (!date) return 'Ainda não realizado'
  const diff = differenceInCalendarDays(new Date(), date)
  if (diff <= 0) return 'Feito hoje'
  if (diff === 1) return 'Feito ontem'
  return `Feito há ${diff} dias`
}

function percentChange(current: number, previous: number) {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

function latestSetLabel(exerciseId: string, sessions: WorkoutSession[]) {
  for (const session of sessions) {
    const item = session.exercises.find((entry) => entry.exerciseId === exerciseId)
    const set = item?.sets[item.sets.length - 1]
    if (set) return `Última vez ${formatDecimal(set.weight)} kg × ${set.reps}`
  }
  return null
}

export default function Dashboard() {
  const router = useRouter()
  const profile = useProfileStore((state) => state.profile)
  const sessions = useProfileStore((state) => state.sessions)
  const workouts = useWorkoutStore((state) => state.workouts)
  const exercises = useWorkoutStore((state) => state.exercises)
  const active = useSessionStore((state) => state.active)
  const startSession = useSessionStore((state) => state.startSession)
  const cardio = useCardioStore((state) => state.sessions)
  const heartToday = useHealthStore((state) => state.heartToday)
  const stepsToday = useHealthStore((state) => state.steps.find((day) => day.date.toDateString() === new Date().toDateString())?.value ?? null)
  useLiveHealth()
  const [starting, setStarting] = useState(false)
  const [now] = useState(() => new Date())

  const streak = profile?.streak ?? 0
  const longestStreak = profile?.longestStreak ?? 0
  const goals = getEffectiveGoals(profile, now)
  const block = profile?.trainingBlock ? getBlockProgress(profile.trainingBlock, now) : null
  const exerciseById = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises])
  const lastByWorkout = useMemo(() => lastSessionByWorkout(sessions), [sessions])

  const week = useMemo(() => {
    const start = startOfWeek(now, { weekStartsOn: 1 })
    const end = endOfWeek(start, { weekStartsOn: 1 })
    const inRange = (session: WorkoutSession, from: Date, to: Date) => {
      const date = finishedAt(session)
      return Boolean(date && isWithinInterval(date, { start: from, end: to }))
    }
    const current = sessions.filter((session) => inRange(session, start, end))
    const previous = sessions.filter((session) => inRange(session, subWeeks(start, 1), subWeeks(end, 1)))
    const days = Array.from({ length: 7 }, (_, index) => {
      const day = addDays(start, index)
      const daySessions = current.filter((session) => isSameDay(finishedAt(session)!, day))
      return { day, sets: daySessions.reduce((total, session) => total + setCount(session), 0), trained: daySessions.length > 0 }
    })
    return {
      count: current.length,
      minutes: Math.round(current.reduce((total, session) => total + session.duration, 0) / 60),
      sets: current.reduce((total, session) => total + setCount(session), 0),
      volume: current.reduce((total, session) => total + session.totalVolume, 0),
      previousVolume: previous.reduce((total, session) => total + session.totalVolume, 0),
      days,
    }
  }, [now, sessions])

  const todays = useMemo(() => workoutsForWeekday(workouts, now.getDay()), [now, workouts])

  const suggested = useMemo(() => {
    if (!workouts.length) return null
    // A workout scheduled for today wins; otherwise the one done longest ago.
    const byAge = [...workouts].sort((a, b) =>
      (finishedAt(lastByWorkout.get(a.id))?.getTime() ?? 0) - (finishedAt(lastByWorkout.get(b.id))?.getTime() ?? 0)
    )
    const scheduledToday = todays.find((workout) => !isSameDay(finishedAt(lastByWorkout.get(workout.id)) ?? new Date(0), now))
    const workout: Workout = scheduledToday ?? byAge[0]
    const list = workout.exerciseIds.map((id) => exerciseById.get(id)).filter((item): item is Exercise => Boolean(item))
    return { workout, exercises: list, primary: list[0], last: finishedAt(lastByWorkout.get(workout.id)), scheduled: Boolean(scheduledToday) }
  }, [exerciseById, lastByWorkout, now, todays, workouts])

  const latest = useMemo(() => {
    const session = sessions.find((item) => item.finishedAt) ?? null
    if (!session) return null
    return { session, workout: workouts.find((item) => item.id === session.workoutId) }
  }, [sessions, workouts])

  const muscles = useMemo(() => muscleSetsInRange(sessions, exercises, subDays(now, 7), now), [exercises, now, sessions])
  const deload = useMemo(() => getDeloadAdvice(sessions, exercises, now), [exercises, now, sessions])
  const muscleNudge = useMemo(() => lateWeekNudge(
    weeklyMuscleReport(sessions.filter((session) => session.finishedAt), exercises, getMuscleTargets(profile?.preferences), now),
    now
  ), [exercises, now, profile?.preferences, sessions])
  const readiness = useTodayReadiness(now)
  const cardioMinutes = cardioMinutesInWeek(cardio, now)
  const cardioGoal = profile?.preferences?.weeklyGoals?.cardioMinutes ?? DEFAULT_CARDIO_GOAL
  const trainedToday = week.days.find((day) => isSameDay(day.day, now))?.trained ?? false

  const lastMonth = subMonths(startOfMonth(now), 1)
  const showRecap = now.getDate() <= 10 && sessions.some((session) => {
    const date = finishedAt(session)
    return date && date >= lastMonth && date < startOfMonth(now)
  })

  const hour = now.getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const firstName = (profile?.name ?? 'Atleta').trim().split(/\s+/)[0]
  const lede = active
    ? `${active.workoutName} está em andamento.`
    : trainedToday
      ? 'Treino de hoje feito. Agora é recuperar.'
      : reminderMessage(todays.map((workout) => workout.name)) ? `${reminderMessage(todays.map((workout) => workout.name))}.` : 'Pronto para treinar?'

  const volumeChange = percentChange(week.volume, week.previousVolume)
  const goalRows = [
    { label: 'Treinos', value: week.count, goal: goals.workouts, unit: '' },
    { label: 'Minutos', value: week.minutes, goal: goals.minutes, unit: 'min' },
    { label: 'Séries', value: week.sets, goal: goals.sets, unit: '' },
    { label: 'Cardio', value: cardioMinutes, goal: cardioGoal, unit: 'min' },
  ]

  async function handleStartSuggested() {
    if (!suggested || starting) return
    setStarting(true)
    try {
      await startSession(suggested.workout, suggested.exercises)
      router.push('/workouts/execute')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="apple-page page-content">
      <LocalNav
        title="Hoje"
        actions={active
          ? <Link href="/workouts/execute" className="pill">Continuar</Link>
          : suggested && <button type="button" onClick={handleStartSuggested} disabled={starting} className="pill">Treinar</button>}
      />

      <Hero
        eyebrow={format(now, "EEEE, d 'de' MMMM", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase())}
        title={<>{greeting},<br />{firstName}.</>}
        lede={lede}
      />

      {/* Featured tile — the next workout */}
      <section aria-labelledby="next-title" className="stack-section">
        <h2 id="next-title" className="sr-only">{active ? 'Em andamento' : 'Próximo treino'}</h2>
        {active ? (
          <FeatureTile
            eyebrow="Em andamento"
            live
            title={active.workoutName}
            subtitle={`${active.exercises.length} exercícios. Continue de onde parou.`}
            primary={<Link href="/workouts/execute" className={buttonClasses()}>Continuar</Link>}
          />
        ) : suggested ? (
          <FeatureTile
            eyebrow={suggested.scheduled ? 'Agendado para hoje' : 'Recomendado'}
            title={suggested.workout.name}
            color={suggested.workout.color}
            subtitle={`${suggested.workout.exerciseIds.length} exercícios · ${suggested.primary?.muscleGroup ?? 'Força'} · ${daysAgoLabel(suggested.last)}`}
            note={suggested.primary ? `Começa com ${suggested.primary.name}${latestSetLabel(suggested.primary.id, sessions) ? `. ${latestSetLabel(suggested.primary.id, sessions)}.` : '.'}` : undefined}
            primary={<button type="button" onClick={handleStartSuggested} disabled={starting} className={buttonClasses()}><Play size={15} fill="currentColor" aria-hidden />Começar</button>}
            secondary={<Link href={`/workouts/detail?id=${suggested.workout.id}`} className="link text-[17px] !text-[#2997ff]">Ver treino<ChevronRight size={17} aria-hidden /></Link>}
          />
        ) : (
          <div className="tile text-center">
            <p className="eyebrow">Comece aqui</p>
            <h3 className="title-1 mt-1">Monte sua primeira rotina.</h3>
            <p className="subhead mx-auto mt-2 max-w-xs text-[var(--muted)]">Escolha os exercícios ou parta de um modelo pronto.</p>
            <Link href="/workouts/new" className={buttonClasses({ className: 'mt-6' })}><Plus size={17} aria-hidden />Criar treino</Link>
          </div>
        )}
      </section>

      {readiness && (
        <Link href="/health" className="tile tile-link mt-3 flex items-center gap-5" aria-label={`Prontidão ${readiness.score} de 100: ${readiness.headline} Abrir Saúde`}>
          <ScoreRing score={readiness.score} size={72} label={`Prontidão ${readiness.score}`} />
          <span className="min-w-0 flex-1">
            <span className="eyebrow block">Prontidão</span>
            <span className="headline mt-0.5 block">{readiness.headline}</span>
            <span className="footnote mt-0.5 block text-[var(--muted)]">{[readiness.recommendation.label, ...readiness.recommendation.reasons.slice(0, 2).map((item) => item.text)].join(' · ')}</span>
          </span>
          <ChevronRight size={18} className="flex-none text-[var(--muted)]" aria-hidden />
        </Link>
      )}

      <HeartRateChip today={heartToday} steps={stepsToday} />

      {deload.suggested && (
        <section className="tile mt-3" aria-labelledby="deload-title">
          <p className="eyebrow">Recuperação</p>
          <h2 id="deload-title" className="title-2 mt-1">Hora de uma semana mais leve.</h2>
          <p className="subhead mt-2 text-[var(--muted)]">
            {deload.declining.slice(0, 3).map((item) => `${item.name} caiu ${item.dropPct}%`).join(', ')} nas últimas sessões.
            Reduza séries e carga pela metade por uma semana e volte mais forte.
          </p>
          <Link href="/workouts#bloco" className="link mt-2 text-[17px]">Planejar deload<ChevronRight size={17} aria-hidden /></Link>
        </section>
      )}

      {showRecap && (
        <Link href={`/recap?month=${format(lastMonth, 'yyyy-MM')}`} className="tile tile-dark tile-link mt-3 block">
          <p className="eyebrow !text-[#ff8a3d]">Retrospectiva</p>
          <p className="title-1 mt-1 text-gradient-dark">Seu {format(lastMonth, 'MMMM', { locale: ptBR })} em números.</p>
          <span className="link mt-2 text-[17px] !text-[#2997ff]">Ver agora<ChevronRight size={17} aria-hidden /></span>
        </Link>
      )}

      {/* Week goals */}
      <section aria-labelledby="week-title" className="stack-section">
        <SectionHeader
          id="week-title"
          title="Sua semana."
          subtitle={goals.fromBlock && block?.week ? `Semana ${block.weekNumber} do bloco${block.week.deload ? ' · deload' : ''}` : undefined}
          action={<Link href="/settings#metas" className="link -mb-2.5 flex-none text-[17px]">Metas<ChevronRight size={17} aria-hidden /></Link>}
        />
        <div className="tile">
          <ol className="grid grid-cols-7 gap-1" aria-label="Dias da semana">
            {week.days.map(({ day, sets, trained }, index) => {
              const today = isSameDay(day, now)
              return (
                <li key={day.toISOString()} className="flex flex-col items-center gap-2" aria-label={`${WEEK_DAY_NAMES[index]} ${day.getDate()}${trained ? `, ${sets} séries` : ', sem treino'}${today ? ', hoje' : ''}`}>
                  <span aria-hidden className={`caption font-semibold ${today ? 'text-[var(--foreground)]' : 'text-[var(--muted)]'}`}>{WEEK_DAYS[index]}</span>
                  <span
                    aria-hidden
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-[15px] font-semibold tabular-nums ${trained ? 'bg-[var(--accent-fill)] text-white' : today ? 'shadow-[inset_0_0_0_1.5px_var(--foreground)]' : 'text-[var(--muted)]'}`}
                  >
                    {day.getDate()}
                  </span>
                </li>
              )
            })}
          </ol>
          <dl className="mt-7 space-y-5">
            {goalRows.map((row) => {
              const pct = Math.min(100, Math.round((row.value / Math.max(row.goal, 1)) * 100))
              return (
                <div key={row.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="subhead text-[var(--muted)]">{row.label}</dt>
                    <dd className="stat text-[28px]">
                      {row.value}<span className="stat-unit">/ {row.goal}{row.unit ? ` ${row.unit}` : ''}</span>
                    </dd>
                  </div>
                  <div className="progress-track mt-2" role="progressbar" aria-label={`${row.label}: ${row.value} de ${row.goal}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                    <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--success-fill)' : undefined }} />
                  </div>
                </div>
              )
            })}
          </dl>
        </div>
      </section>

      {/* Highlights */}
      <section aria-labelledby="highlights-title" className="stack-section">
        <SectionHeader id="highlights-title" title="Destaques." href="/stats" />
        <div className="grid grid-cols-2 gap-3">
          <HighlightTile
            label="Volume"
            value={formatVolume(week.volume)}
            note={volumeChange == null ? 'nesta semana' : `${volumeChange >= 0 ? '+' : ''}${volumeChange}% vs. semana passada`}
          />
          <HighlightTile
            label="Sequência"
            value={`${streak} ${streak === 1 ? 'dia' : 'dias'}`}
            note={`Recorde de ${longestStreak} ${longestStreak === 1 ? 'dia' : 'dias'}`}
          />
          <HighlightTile
            label="Última sessão"
            value={latest ? formatVolume(latest.session.totalVolume) : '—'}
            note={latest ? `${latest.workout?.name ?? 'Treino'} · ${formatDate(finishedAt(latest.session)!)}` : 'Nenhum treino ainda'}
            wide
          />
        </div>
      </section>

      {/* Muscle map */}
      <section aria-labelledby="muscles-title" className="stack-section">
        <SectionHeader id="muscles-title" title="Músculos." subtitle="Séries nos últimos 7 dias." href="/stats#musculos" />
        <div className="tile">
          {muscleNudge && (
            <Link href="/stats#volume-semanal" className="subhead mb-6 flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--warning-soft)] px-4 py-3">
              <span className="min-w-0 flex-1">{muscleNudge.message}</span>
              <ChevronRight size={17} className="flex-none text-[var(--muted)]" aria-hidden />
            </Link>
          )}
          <MuscleMap sets={muscles} compact />
        </div>
      </section>
    </div>
  )
}

function FeatureTile({ eyebrow, live, title, subtitle, note, primary, secondary, color }: {
  eyebrow: string
  live?: boolean
  title: string
  subtitle: string
  note?: string
  primary: React.ReactNode
  secondary?: React.ReactNode
  color?: string
}) {
  return (
    <div className="tile tile-dark overflow-hidden px-6 pb-8 pt-9 text-center">
      {color && (
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-56 w-[140%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-45 blur-3xl"
          style={{ background: color }}
        />
      )}
      <div className="relative">
        <p className="eyebrow flex items-center justify-center gap-2 !text-[#ff8a3d]">
          {live && <span aria-hidden className="live-dot h-2 w-2 rounded-full bg-[#30d158]" />}{eyebrow}
        </p>
        <h3 className="display mt-2 text-[#f5f5f7]">{title}</h3>
        <p className="subhead mx-auto mt-3 max-w-sm text-[#a1a1a6]">{subtitle}</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {primary}
          {secondary}
        </div>
        {note && <p className="footnote mx-auto mt-6 max-w-sm text-[#a1a1a6]">{note}</p>}
      </div>
    </div>
  )
}

function HighlightTile({ label, value, note, wide }: { label: string; value: string; note: string; wide?: boolean }) {
  return (
    <div className={`tile tile-compact flex min-h-[140px] flex-col ${wide ? 'col-span-2' : ''}`}>
      <p className="subhead font-semibold text-[var(--muted)]">{label}</p>
      <p className="stat mt-auto truncate pt-4 text-[30px]">{value}</p>
      <p className="footnote mt-1 line-clamp-2 text-[var(--muted)]">{note}</p>
    </div>
  )
}
