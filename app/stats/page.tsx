'use client'

import { type CSSProperties, useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, Clock, Dumbbell, TrendingUp, Weight } from 'lucide-react'
import { useProfileStore } from '@/stores/useProfileStore'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formatDuration, formatVolume } from '@/lib/utils'

type Period = 'week' | 'month' | 'year'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Ano' },
]

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <Card glass className="p-4">
      <div className="soft-icon mb-3 flex h-9 w-9 items-center justify-center rounded-2xl">
        <Icon size={16} />
      </div>
      <p className="text-2xl font-bold tracking-tight text-[var(--foreground)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{label}</p>
    </Card>
  )
}

function SimpleBarChart({ data }: { data: Array<{ label: string; volume: number }> }) {
  const max = Math.max(...data.map((item) => item.volume), 1)

  return (
    <div className="grid h-44 items-end gap-2" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
      {data.map((item) => (
        <div key={item.label} className="flex h-full min-w-0 flex-col justify-end gap-2">
          <div className="flex min-h-0 flex-1 items-end rounded-xl bg-[var(--surface-2)]/55 px-1">
            <div
              className="w-full rounded-t-lg bg-[var(--accent)]"
              style={{ height: `${Math.max((item.volume / max) * 100, item.volume > 0 ? 8 : 0)}%` }}
              title={`${item.label}: ${formatVolume(item.volume)}`}
            />
          </div>
          <span className="truncate text-center text-[11px] font-medium text-[var(--muted)]">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

function SimpleAreaChart({ data }: { data: Array<{ label: string; treinos: number }> }) {
  const max = Math.max(...data.map((item) => item.treinos), 1)
  const width = 280
  const height = 108
  const step = data.length > 1 ? width / (data.length - 1) : width
  const points = data.map((item, index) => {
    const x = index * step
    const y = height - (item.treinos / max) * (height - 14) - 7
    return { x, y, ...item }
  })
  const line = points.map((point) => `${point.x},${point.y}`).join(' ')
  const area = `0,${height} ${line} ${width},${height}`

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full overflow-visible" role="img" aria-label="Frequencia de treinos">
        <polygon points={area} fill="color-mix(in srgb, var(--accent) 16%, transparent)" />
        <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <circle key={point.label} cx={point.x} cy={point.y} r="4" fill="var(--accent)" />
        ))}
      </svg>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` } as CSSProperties}>
        {data.map((item) => (
          <span key={item.label} className="truncate text-center text-[11px] font-medium text-[var(--muted)]">
            {item.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function StatsPage() {
  const { sessions } = useProfileStore()
  const { workouts, exercises } = useWorkoutStore()
  const [period, setPeriod] = useState<Period>('month')
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(() => new Date())

  const filteredSessions = useMemo(() => {
    const now = new Date()
    if (period === 'week') {
      const start = startOfWeek(now, { weekStartsOn: 1 })
      return sessions.filter((session) => session.finishedAt && new Date(session.finishedAt) >= start)
    }
    if (period === 'month') {
      return sessions.filter((session) => session.finishedAt && new Date(session.finishedAt) >= subMonths(now, 1))
    }
    return sessions.filter((session) => session.finishedAt && new Date(session.finishedAt) >= subMonths(now, 12))
  }, [period, sessions])

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, typeof sessions>()
    sessions.forEach((session) => {
      if (!session.finishedAt) return
      const key = format(new Date(session.finishedAt), 'yyyy-MM-dd')
      map.set(key, [...(map.get(key) ?? []), session])
    })
    return map
  }, [sessions])

  const selectedSessions = useMemo(() => {
    const key = format(selectedDate, 'yyyy-MM-dd')
    return sessionsByDay.get(key) ?? []
  }, [selectedDate, sessionsByDay])
  const workoutNames = useMemo(() => new Map(workouts.map((workout) => [workout.id, workout.name])), [workouts])
  const exerciseNames = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise.name])), [exercises])

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [calendarMonth])

  const volumeChartData = useMemo(() => {
    const now = new Date()
    if (period === 'week') {
      const days = eachDayOfInterval({
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
      })
      return days.map((day) => ({
        label: format(day, 'EEE', { locale: ptBR }),
        volume: sessions
          .filter((session) => session.finishedAt && isSameDay(new Date(session.finishedAt), day))
          .reduce((total, session) => total + session.totalVolume, 0),
      }))
    }

    if (period === 'month') {
      return Array.from({ length: 4 }, (_, index) => {
        const start = subWeeks(now, 3 - index)
        const end = endOfWeek(start, { weekStartsOn: 1 })
        return {
          label: `S${index + 1}`,
          volume: sessions
            .filter((session) => session.finishedAt && isWithinInterval(new Date(session.finishedAt), { start, end }))
            .reduce((total, session) => total + session.totalVolume, 0),
        }
      })
    }

    return Array.from({ length: 12 }, (_, index) => {
      const month = subMonths(now, 11 - index)
      return {
        label: format(month, 'MMM', { locale: ptBR }),
        volume: sessions
          .filter((session) => session.finishedAt && isSameMonth(new Date(session.finishedAt), month))
          .reduce((total, session) => total + session.totalVolume, 0),
      }
    })
  }, [period, sessions])

  const frequencyData = useMemo(
    () =>
      Array.from({ length: 8 }, (_, index) => {
        const start = subWeeks(new Date(), 7 - index)
        const end = endOfWeek(start, { weekStartsOn: 1 })
        return {
          label: `S${index + 1}`,
          treinos: sessions.filter(
            (session) => session.finishedAt && isWithinInterval(new Date(session.finishedAt), { start, end })
          ).length,
        }
      }),
    [sessions]
  )

  const totalVolume = filteredSessions.reduce((total, session) => total + session.totalVolume, 0)
  const totalTime = filteredSessions.reduce((total, session) => total + session.duration, 0)
  const allTimeVolume = sessions.reduce((total, session) => total + session.totalVolume, 0)

  return (
    <div className="apple-page page-content space-y-5 pb-28">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Performance</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--foreground)]">Estatisticas</h1>
      </header>

      <div
        className="grid grid-cols-3 gap-1 rounded-xl p-1"
        style={{ background: 'var(--glass-strong)', border: '1px solid var(--border)' }}
      >
        {PERIODS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setPeriod(item.value)}
            className="h-10 rounded-lg text-sm font-bold transition"
            style={
              period === item.value
                ? { background: 'var(--accent)', color: 'white' }
                : { color: 'var(--muted)' }
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="grid grid-cols-3 gap-3">
        <MetricCard icon={Dumbbell} label="Treinos" value={`${filteredSessions.length}`} />
        <MetricCard icon={Weight} label="Volume" value={formatVolume(totalVolume)} />
        <MetricCard icon={Clock} label="Tempo" value={formatDuration(totalTime)} />
      </section>

      <Card glass className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-[var(--accent)]" />
          <h2 className="apple-section-title">Volume</h2>
        </div>
        <SimpleBarChart data={volumeChartData} />
      </Card>

      <Card glass className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 size={16} className="text-[var(--accent)]" />
          <h2 className="apple-section-title">Frequencia</h2>
        </div>
        <SimpleAreaChart data={frequencyData} />
      </Card>

      <Card glass className="p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-[var(--accent)]" />
            <h2 className="apple-section-title">Calendario</h2>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setCalendarMonth((month) => subMonths(month, 1))}
              aria-label="Mes anterior"
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setCalendarMonth((month) => addMonths(month, 1))}
              aria-label="Proximo mes"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>

        <p className="mb-4 text-sm font-bold capitalize text-[var(--foreground)]">
          {format(calendarMonth, 'MMMM yyyy', { locale: ptBR })}
        </p>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-[var(--muted)]">
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => (
            <span key={`${day}-${index}`} className="py-1">
              {day}
            </span>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const count = sessionsByDay.get(key)?.length ?? 0
            const selected = isSameDay(day, selectedDate)
            const inMonth = isSameMonth(day, calendarMonth)

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDate(day)}
                className="relative aspect-square rounded-2xl text-sm font-bold transition-colors"
                style={{
                  color: selected ? 'white' : inMonth ? 'var(--foreground)' : 'var(--muted)',
                  background: selected
                    ? 'var(--accent)'
                    : count > 0
                      ? 'color-mix(in srgb, var(--accent) 14%, transparent)'
                      : 'color-mix(in srgb, var(--surface-2) 70%, transparent)',
                  opacity: inMonth ? 1 : 0.45,
                }}
              >
                {format(day, 'd')}
                {count > 0 && (
                  <span
                    className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
                    style={{ background: selected ? 'white' : 'var(--accent)' }}
                  />
                )}
              </button>
            )
          })}
        </div>

        <div className="mt-4 rounded-2xl bg-[var(--surface-2)]/70 p-3">
          <p className="text-xs font-bold text-[var(--muted)]">
            {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
          </p>
          {selectedSessions.length > 0 ? (
            <div className="mt-3 space-y-3">
              {selectedSessions.map((session) => {
                const setCount = session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0)
                const exerciseList = session.exercises
                  .map((exercise) => exerciseNames.get(exercise.exerciseId))
                  .filter(Boolean)
                  .slice(0, 4)
                  .join(', ')

                return (
                  <div key={session.id} className="rounded-2xl bg-[var(--surface)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[var(--foreground)]">
                          {workoutNames.get(session.workoutId) ?? 'Treino'}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">
                          {setCount} series - {formatDuration(session.duration)}
                        </p>
                      </div>
                      <span className="flex-none text-sm font-bold text-[var(--accent)]">
                        {formatVolume(session.totalVolume)}
                      </span>
                    </div>
                    {exerciseList && (
                      <p className="mt-2 line-clamp-2 text-xs text-[var(--muted)]">{exerciseList}</p>
                    )}
                  </div>
                )
              })}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-[var(--surface)] p-2">
                  <p className="text-sm font-bold text-[var(--foreground)]">{selectedSessions.length}</p>
                  <p className="text-[10px] text-[var(--muted)]">treinos</p>
                </div>
                <div className="rounded-2xl bg-[var(--surface)] p-2">
                  <p className="text-sm font-bold text-[var(--foreground)]">
                    {formatVolume(selectedSessions.reduce((total, session) => total + session.totalVolume, 0))}
                  </p>
                  <p className="text-[10px] text-[var(--muted)]">volume</p>
                </div>
                <div className="rounded-2xl bg-[var(--surface)] p-2">
                  <p className="text-sm font-bold text-[var(--foreground)]">
                    {formatDuration(selectedSessions.reduce((total, session) => total + session.duration, 0))}
                  </p>
                  <p className="text-[10px] text-[var(--muted)]">tempo</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-[var(--muted)]">Nenhum treino registrado nesse dia.</p>
          )}
        </div>
      </Card>

      <Card glass className="p-4">
        <h2 className="apple-section-title">Todos os tempos</h2>
        <div className="mt-3 divide-y divide-[var(--border)]">
          {[
            { label: 'Total de treinos', value: `${sessions.length}` },
            { label: 'Volume total', value: formatVolume(allTimeVolume) },
            { label: 'Tempo total', value: formatDuration(sessions.reduce((total, session) => total + session.duration, 0)) },
            { label: 'Media por treino', value: sessions.length > 0 ? formatVolume(allTimeVolume / sessions.length) : '-' },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-3 text-sm">
              <span className="text-[var(--muted)]">{item.label}</span>
              <span className="font-bold text-[var(--foreground)]">{item.value}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
