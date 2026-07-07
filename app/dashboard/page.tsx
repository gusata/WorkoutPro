'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Clock,
  Dumbbell,
  Flame,
  Plus,
  Ruler,
  Sparkles,
  Target,
  Trophy,
  Weight,
} from 'lucide-react'
import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  isSameDay,
  isWithinInterval,
  startOfWeek,
} from 'date-fns'
import { useProfileStore } from '@/stores/useProfileStore'
import { useSessionStore } from '@/stores/useSessionStore'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import { getLevelFromXp, levelTitle } from '@/lib/gamification'
import { formatDate, formatDuration, formatVolume } from '@/lib/utils'
import type { Workout, WorkoutSession } from '@/types'

const CORAL = '#e65f43'
const AMBER = '#f59e0b'
const INK = '#1f2024'
const WEEK_TARGET = 4
const WEEK_DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function daysAgoLabel(date: Date | null) {
  if (!date) return 'Nunca feito'

  const diff = differenceInCalendarDays(new Date(), date)
  if (diff <= 0) return 'Hoje'
  if (diff === 1) return 'Ontem'
  return `Ha ${diff} dias`
}

function getSessionDate(session: WorkoutSession) {
  return new Date(session.finishedAt ?? session.startedAt)
}

function findSuggestedWorkout(workouts: Workout[], sessions: WorkoutSession[]) {
  if (workouts.length === 0) return null

  const lastByWorkout = new Map<string, Date>()
  sessions.forEach((session) => {
    if (!session.finishedAt) return
    const current = lastByWorkout.get(session.workoutId)
    const date = new Date(session.finishedAt)
    if (!current || date > current) lastByWorkout.set(session.workoutId, date)
  })

  return [...workouts].sort((a, b) => {
    const aLast = lastByWorkout.get(a.id)?.getTime() ?? 0
    const bLast = lastByWorkout.get(b.id)?.getTime() ?? 0
    return aLast - bLast
  })[0]
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string
  color: string
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: `${color}18`, color }}>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-bold tracking-tight text-[var(--foreground)]">{value}</p>
      <p className="mt-1 text-xs font-medium text-[var(--muted)]">{label}</p>
    </Card>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const { profile, sessions, measurements } = useProfileStore()
  const { workouts, exercises } = useWorkoutStore()
  const { active, startSession } = useSessionStore()

  const levelInfo = useMemo(
    () => (profile ? getLevelFromXp(profile.xp) : { level: 1, currentXp: 0, xpNeeded: 100 }),
    [profile]
  )

  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 0 })
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart])

  const weekSessions = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 })
    const end = endOfWeek(new Date(), { weekStartsOn: 1 })
    return sessions.filter((session) =>
      session.finishedAt &&
      isWithinInterval(new Date(session.finishedAt), { start, end })
    )
  }, [sessions])

  const weekVolume = weekSessions.reduce((total, session) => total + session.totalVolume, 0)
  const weekTime = weekSessions.reduce((total, session) => total + session.duration, 0)
  const latestSession = sessions.find((session) => session.finishedAt) ?? null
  const suggestedWorkout = useMemo(() => findSuggestedWorkout(workouts, sessions), [workouts, sessions])
  const suggestedLastSession = suggestedWorkout
    ? sessions.find((session) => session.workoutId === suggestedWorkout.id && session.finishedAt)
    : null
  const suggestedExercises = suggestedWorkout?.exerciseIds
    .map((id) => exercises.find((exercise) => exercise.id === id))
    .filter(Boolean) ?? []
  const primaryExercise = suggestedExercises[0]
  const primaryExerciseLastSet = primaryExercise
    ? sessions
        .flatMap((session) => session.exercises.filter((exercise) => exercise.exerciseId === primaryExercise.id))
        .flatMap((exercise) => exercise.sets)
        .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0]
    : null

  const latestWorkout = latestSession ? workouts.find((workout) => workout.id === latestSession.workoutId) : null
  const latestTopExercise = latestSession
    ? latestSession.exercises
        .map((sessionExercise) => {
          const exercise = exercises.find((item) => item.id === sessionExercise.exerciseId)
          const volume = sessionExercise.sets.reduce((total, set) => total + set.weight * set.reps, 0)
          return { exercise, volume, sets: sessionExercise.sets.length }
        })
        .sort((a, b) => b.volume - a.volume)[0]
    : null

  const currentWeight = measurements.find((measurement) => measurement.weight != null)?.weight ?? null
  const levelPct = Math.min((levelInfo.currentXp / Math.max(levelInfo.xpNeeded, 1)) * 100, 100)
  const weekPct = Math.min((weekSessions.length / WEEK_TARGET) * 100, 100)

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Bom dia'
    if (hour < 18) return 'Boa tarde'
    return 'Boa noite'
  }, [])

  async function handleStartSuggested() {
    if (!suggestedWorkout) return
    const selectedExercises = suggestedWorkout.exerciseIds
      .map((id) => exercises.find((exercise) => exercise.id === id))
      .filter(Boolean) as typeof exercises

    await startSession(suggestedWorkout, selectedExercises)
    router.push('/workouts/execute')
  }

  return (
    <div className="apple-page page-content space-y-5 pb-28">
      <header className="flex items-start justify-between pr-14">
        <div>
          <p className="text-sm font-semibold text-[var(--muted)]">{greeting},</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--foreground)]">{profile?.name ?? 'Atleta'}</h1>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `${CORAL}16`, color: CORAL }}>
          <Flame size={22} />
        </div>
      </header>

      <Card glass className="p-5">
        {active ? (
          <Link href="/workouts/execute" className="block">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-white" style={{ background: active.workoutColor }}>
                <Activity size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Treino em andamento</p>
                <h2 className="mt-1 truncate text-2xl font-bold text-[var(--foreground)]">{active.workoutName}</h2>
              </div>
            </div>
            <Button className="w-full">
              Continuar treino
              <ArrowRight size={16} />
            </Button>
          </Link>
        ) : suggestedWorkout ? (
          <>
            <div className="mb-5 flex items-start gap-4">
              <div className="flex h-14 w-14 flex-none items-center justify-center rounded-[1.35rem] text-white" style={{ background: suggestedWorkout.color }}>
                <Dumbbell size={23} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Treino sugerido hoje</p>
                <h2 className="mt-1 truncate text-2xl font-bold text-[var(--foreground)]">{suggestedWorkout.name}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {daysAgoLabel(suggestedLastSession ? getSessionDate(suggestedLastSession) : null)} - {suggestedWorkout.exerciseIds.length} exercicios
                </p>
              </div>
            </div>
            <div className="mb-4 rounded-2xl bg-[var(--surface-2)]/70 p-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Proximo foco</p>
              <p className="mt-1 text-sm font-bold text-[var(--foreground)]">{primaryExercise?.name ?? 'Criar historico'}</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {primaryExerciseLastSet
                  ? `Ultimo: ${primaryExerciseLastSet.weight}kg x ${primaryExerciseLastSet.reps}`
                  : primaryExercise
                    ? primaryExercise.muscleGroup
                    : 'Adicione exercicios para receber uma sugestao melhor'}
              </p>
            </div>
            <Button className="w-full" onClick={handleStartSuggested}>
              Iniciar treino
              <ArrowRight size={16} />
            </Button>
          </>
        ) : (
          <>
            <div className="mb-5 flex items-center gap-4">
              <div className="soft-icon flex h-14 w-14 items-center justify-center rounded-[1.35rem]">
                <Sparkles size={23} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Comece por aqui</p>
                <h2 className="mt-1 text-2xl font-bold text-[var(--foreground)]">Monte sua primeira rotina</h2>
              </div>
            </div>
            <Link href="/workouts/new">
              <Button className="w-full">
                <Plus size={16} />
                Criar treino
              </Button>
            </Link>
          </>
        )}
      </Card>

      <section>
        <h2 className="apple-section-title mb-3">Semana atual</h2>
        <Card className="p-4">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[var(--foreground)]">Meta semanal</p>
              <p className="text-xs text-[var(--muted)]">{weekSessions.length} de {WEEK_TARGET} treinos</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: `${CORAL}16`, color: CORAL }}>
              <Target size={19} />
            </div>
          </div>
          <Progress value={weekPct} max={100} color={CORAL} />
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {weekDays.map((day, index) => {
              const trained = weekSessions.some((session) => session.finishedAt && isSameDay(new Date(session.finishedAt), day))
              const today = isSameDay(day, new Date())

              return (
                <div key={day.toISOString()} className="text-center">
                  <p className="mb-1 text-[10px] font-bold text-[var(--muted)]">{WEEK_DAYS[index]}</p>
                  <div
                    className="mx-auto flex h-9 w-9 items-center justify-center rounded-2xl text-xs font-bold"
                    style={{
                      background: trained ? CORAL : today ? 'var(--surface-3)' : 'var(--surface-2)',
                      color: trained ? 'white' : 'var(--muted)',
                      border: today ? '1px solid var(--accent)' : '1px solid transparent',
                    }}
                  >
                    {day.getDate()}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </section>

      <section>
        <h2 className="apple-section-title mb-3">Minha atividade</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Dumbbell} label="Treinos" value={`${weekSessions.length}`} color={CORAL} />
          <StatCard icon={Weight} label="Volume" value={formatVolume(weekVolume)} color={INK} />
          <StatCard icon={Clock} label="Tempo" value={formatDuration(weekTime)} color={AMBER} />
        </div>
      </section>

      {latestSession && (
        <section>
          <h2 className="apple-section-title mb-3">Ultimo desempenho</h2>
          <Card glass className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl text-white" style={{ background: latestWorkout?.color ?? CORAL }}>
                <Trophy size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--foreground)]">{latestWorkout?.name ?? 'Treino'}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{formatDate(getSessionDate(latestSession))}</p>
                  </div>
                  <p className="flex-none text-xs font-bold text-[var(--accent)]">+{latestSession.xpEarned} XP</p>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-[var(--surface-2)] p-2">
                    <p className="text-sm font-bold text-[var(--foreground)]">{formatVolume(latestSession.totalVolume)}</p>
                    <p className="text-[10px] text-[var(--muted)]">volume</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--surface-2)] p-2">
                    <p className="text-sm font-bold text-[var(--foreground)]">{formatDuration(latestSession.duration)}</p>
                    <p className="text-[10px] text-[var(--muted)]">tempo</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--surface-2)] p-2">
                    <p className="text-sm font-bold text-[var(--foreground)]">
                      {latestSession.exercises.reduce((total, exercise) => total + exercise.sets.length, 0)}
                    </p>
                    <p className="text-[10px] text-[var(--muted)]">series</p>
                  </div>
                </div>
                {latestTopExercise?.exercise && (
                  <p className="mt-3 text-xs text-[var(--muted)]">
                    Maior volume: <span className="font-bold text-[var(--foreground)]">{latestTopExercise.exercise.name}</span>
                  </p>
                )}
              </div>
            </div>
          </Card>
        </section>
      )}

      <section>
        <h2 className="apple-section-title mb-3">Atalhos</h2>
        <div className="grid grid-cols-3 gap-3">
          <Link href="/workouts/new">
            <Card pressable className="p-3 text-center">
              <Plus size={17} className="mx-auto text-[var(--accent)]" />
              <p className="mt-2 text-xs font-bold text-[var(--foreground)]">Novo treino</p>
            </Card>
          </Link>
          <Link href="/stats">
            <Card pressable className="p-3 text-center">
              <CalendarDays size={17} className="mx-auto text-[var(--accent)]" />
              <p className="mt-2 text-xs font-bold text-[var(--foreground)]">Stats</p>
            </Card>
          </Link>
          <Link href="/profile">
            <Card pressable className="p-3 text-center">
              <Ruler size={17} className="mx-auto text-[var(--accent)]" />
              <p className="mt-2 text-xs font-bold text-[var(--foreground)]">
                {currentWeight ? `${currentWeight}kg` : 'Medidas'}
              </p>
            </Card>
          </Link>
        </div>
      </section>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Nivel {levelInfo.level}</p>
            <h2 className="mt-1 text-base font-bold text-[var(--foreground)]">{levelTitle(levelInfo.level)}</h2>
          </div>
          <div className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: CORAL }}>
            {Math.round(levelPct)}%
          </div>
        </div>
        <Progress className="mt-4" value={levelInfo.currentXp} max={levelInfo.xpNeeded} color={CORAL} />
        <div className="mt-3 flex items-center justify-between text-xs text-[var(--muted)]">
          <span>{levelInfo.currentXp.toLocaleString()} XP</span>
          <span>{levelInfo.xpNeeded.toLocaleString()} XP</span>
        </div>
      </Card>
    </div>
  )
}
