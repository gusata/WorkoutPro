'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isWithinInterval,
  startOfDay, startOfMonth, startOfWeek, subDays, subMonths, subWeeks, subYears,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useProfileStore } from '@/stores/useProfileStore'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Hero, LocalNav, SectionHeader } from '@/components/layout/PageHeader'
import { AchievementIcon } from '@/components/achievements/AchievementIcon'
import { MuscleMap } from '@/components/insights/MuscleMap'
import { ConsistencyHeatmap } from '@/components/insights/ConsistencyHeatmap'
import { StrengthCard } from '@/components/insights/StrengthCard'
import { formatDuration, formatVolume } from '@/lib/utils'
import { getMonthWeekBuckets, getStatsInterval, getWeeklyBuckets, type StatsPeriod } from '@/lib/statsPeriods'
import { comparePeriods } from '@/lib/training'
import { setsByDay } from '@/lib/insights'
import { getMuscleTargets, muscleVolumeInRange, weekRange, weeklyMuscleReport } from '@/lib/muscleVolume'
import { MuscleVolumeBars } from '@/components/insights/MuscleVolumeBars'
import type { MuscleGroup } from '@/types'
import { ACHIEVEMENTS } from '@/lib/achievements'

const PERIODS: { value: StatsPeriod; label: string }[] = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
  { value: 'year', label: 'Ano' },
]

function BarChart({ data, format: formatValue }: { data: Array<{ label: string; value: number }>; format: (value: number) => string }) {
  const max = Math.max(...data.map((item) => item.value), 1)
  const lastWithValue = data.map((item) => item.value > 0).lastIndexOf(true)
  return (
    <figure>
      <figcaption className="sr-only">{data.map((item) => `${item.label}: ${formatValue(item.value)}`).join('; ')}</figcaption>
      <div aria-hidden className="relative h-44">
        {[0, 0.5, 1].map((line) => (
          <div key={line} className="absolute left-0 right-0 border-t border-[var(--separator)] opacity-70" style={{ bottom: `${line * 100}%` }} />
        ))}
        <div className="relative z-[1] grid h-full items-end gap-2" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
          {data.map((item, index) => (
            <div key={item.label} className="flex h-full items-end justify-center">
              <div
                className="w-full max-w-6 rounded-[4px] transition-[height] duration-700"
                style={{
                  height: `${item.value > 0 ? Math.max((item.value / max) * 100, 3) : 0}%`,
                  background: index === lastWithValue ? 'var(--data-1)' : 'color-mix(in srgb, var(--data-1) 38%, var(--fill-strong))',
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
        {data.map((item) => <span key={item.label} className="caption truncate text-center capitalize text-[var(--muted)]">{item.label.replace('.', '')}</span>)}
      </div>
    </figure>
  )
}

export default function StatsPage() {
  const sessions = useProfileStore((state) => state.sessions)
  const achievements = useProfileStore((state) => state.achievements)
  const longestStreak = useProfileStore((state) => state.profile?.longestStreak ?? 0)
  const workouts = useWorkoutStore((state) => state.workouts)
  const exercises = useWorkoutStore((state) => state.exercises)
  const [now] = useState(() => new Date())
  const [period, setPeriod] = useState<StatsPeriod>('month')
  const [chartMode, setChartMode] = useState<'volume' | 'frequency'>('volume')
  const [muscleRange, setMuscleRange] = useState<'week' | 'month'>('week')
  const [volumeWeek, setVolumeWeek] = useState<'current' | 'previous'>('current')
  const preferences = useProfileStore((state) => state.profile?.preferences)
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(() => new Date())

  const finished = useMemo(() => sessions.filter((session) => session.finishedAt), [sessions])
  const filteredSessions = useMemo(() => {
    const interval = getStatsInterval(period, now)
    return finished.filter((session) => isWithinInterval(new Date(session.finishedAt!), interval))
  }, [finished, now, period])

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, typeof sessions>()
    finished.forEach((session) => {
      const key = format(new Date(session.finishedAt!), 'yyyy-MM-dd')
      map.set(key, [...(map.get(key) ?? []), session])
    })
    return map
  }, [finished])
  const dailySets = useMemo(() => setsByDay(sessions), [sessions])
  const muscleTargets = useMemo(() => getMuscleTargets(preferences), [preferences])
  const muscleDetails = useMemo(() => {
    const finishedOnly = sessions.filter((session) => session.finishedAt)
    if (muscleRange === 'week') {
      const { start, end } = weekRange(now)
      return muscleVolumeInRange(finishedOnly, exercises, start, end)
    }
    return muscleVolumeInRange(finishedOnly, exercises, startOfDay(subDays(now, 27)), now)
  }, [exercises, muscleRange, now, sessions])
  const muscleScale = useMemo(() => {
    // The month view is shown as a weekly average so the same color scale applies.
    const weeks = muscleRange === 'week' ? 1 : 4
    return new Map<MuscleGroup, number>([...muscleDetails].map(([group, entry]) => [group, entry.sets / weeks]))
  }, [muscleDetails, muscleRange])
  const volumeRows = useMemo(
    () => weeklyMuscleReport(sessions.filter((session) => session.finishedAt), exercises, muscleTargets, now, volumeWeek === 'current' ? 0 : 1),
    [exercises, muscleTargets, now, sessions, volumeWeek]
  )

  const selectedSessions = sessionsByDay.get(format(selectedDate, 'yyyy-MM-dd')) ?? []
  const workoutNames = useMemo(() => new Map(workouts.map((workout) => [workout.id, workout.name])), [workouts])
  const exerciseNames = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise.name])), [exercises])

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [calendarMonth])

  const chartData = useMemo(() => {
    const volumeIn = (predicate: (date: Date) => boolean) => finished
      .filter((session) => predicate(new Date(session.finishedAt!)))
      .reduce((total, session) => total + session.totalVolume, 0)
    if (chartMode === 'frequency') {
      return getWeeklyBuckets(8, now).map(({ start, end }, index) => ({
        label: `S${index + 1}`,
        value: finished.filter((session) => isWithinInterval(new Date(session.finishedAt!), { start, end })).length,
      }))
    }
    if (period === 'week') {
      return eachDayOfInterval({ start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) })
        .map((day) => ({ label: format(day, 'EEEEE', { locale: ptBR }), value: volumeIn((date) => isSameDay(date, day)) }))
    }
    if (period === 'month') {
      return getMonthWeekBuckets(now).map(({ start, end }, index) => ({ label: `S${index + 1}`, value: volumeIn((date) => isWithinInterval(date, { start, end })) }))
    }
    return Array.from({ length: 12 }, (_, index) => {
      const month = subMonths(now, 11 - index)
      return { label: format(month, 'MMMMM', { locale: ptBR }), value: volumeIn((date) => isSameMonth(date, month)) }
    })
  }, [chartMode, finished, now, period])

  const totalVolume = filteredSessions.reduce((total, session) => total + session.totalVolume, 0)
  const totalTime = filteredSessions.reduce((total, session) => total + session.duration, 0)
  const allTimeVolume = finished.reduce((total, session) => total + session.totalVolume, 0)
  const previousReference = period === 'week' ? subWeeks(now, 1) : period === 'month' ? subMonths(now, 1) : subYears(now, 1)
  const previousSessions = finished.filter((session) => isWithinInterval(new Date(session.finishedAt!), getStatsInterval(period, previousReference)))
  const previousVolume = previousSessions.reduce((total, session) => total + session.totalVolume, 0)
  const volumeChange = comparePeriods(totalVolume, previousVolume)
  const unlockedIds = new Set(achievements.map((item) => item.id))
  const nextAchievements = ACHIEVEMENTS.filter((item) => !unlockedIds.has(item.id)).slice(0, 3)
  const periodLabel = period === 'week' ? 'nesta semana' : period === 'month' ? 'neste mês' : 'neste ano'
  const previousLabel = period === 'week' ? 'na semana passada' : period === 'month' ? 'no mês passado' : 'no ano passado'
  const activeDays26 = [...dailySets.keys()].filter((key) => new Date(key) >= subWeeks(now, 26)).length

  const lede = filteredSessions.length === 0
    ? `Nenhum treino ${periodLabel} ainda.`
    : previousVolume <= 0
      ? `${formatVolume(totalVolume)} levantados ${periodLabel}.`
      : `Volume ${Math.abs(volumeChange)}% ${volumeChange >= 0 ? 'acima' : 'abaixo'} do registrado ${previousLabel}.`

  return (
    <div className="apple-page page-content">
      <LocalNav title="Progresso" actions={<Link href={`/recap?month=${format(subMonths(now, now.getDate() <= 7 ? 1 : 0), 'yyyy-MM')}`} className="pill">Retrospectiva</Link>} />

      <Hero eyebrow="Tendências" title="Progresso." lede={lede} />

      <div className="mt-8">
        <SegmentedControl label="Período" value={period} onChange={setPeriod} options={PERIODS} />
      </div>

      <section className="tile mt-4 grid grid-cols-3 gap-2 !px-5" aria-label="Resumo do período">
        {[
          { label: 'Treinos', value: `${filteredSessions.length}` },
          { label: 'Volume', value: formatVolume(totalVolume) },
          { label: 'Tempo', value: formatDuration(totalTime) },
        ].map(({ label, value }) => (
          <div key={label} className="min-w-0">
            <p className="footnote text-[var(--muted)]">{label}</p>
            <p className="stat mt-1 truncate text-[22px]">{value}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="chart-title" className="stack-section">
        <SectionHeader id="chart-title" title="Evolução." />
        <div className="tile">
          <SegmentedControl
            label="Métrica do gráfico"
            value={chartMode}
            onChange={setChartMode}
            options={[{ value: 'volume', label: 'Volume' }, { value: 'frequency', label: 'Frequência' }]}
          />
          <p className="subhead mt-6 text-[var(--muted)]">{chartMode === 'volume' ? `Volume ${periodLabel}` : 'Treinos por semana · 8 semanas'}</p>
          <p className="stat mb-5 mt-1 text-[36px]">
            {chartMode === 'volume' ? formatVolume(totalVolume) : chartData.reduce((total, item) => total + item.value, 0)}
            {chartMode === 'frequency' && <span className="stat-unit">treinos</span>}
          </p>
          <BarChart data={chartData} format={chartMode === 'volume' ? formatVolume : (value) => `${value} treinos`} />
        </div>
      </section>

      <section aria-labelledby="strength-title" className="stack-section">
        <SectionHeader id="strength-title" title="Força." subtitle="1RM estimado por exercício, com tendência." />
        <StrengthCard exercises={exercises} sessions={sessions} workouts={workouts} />
      </section>

      <section id="musculos" aria-labelledby="muscles-title" className="stack-section scroll-mt-20">
        <SectionHeader id="muscles-title" title="Músculos." subtitle={muscleRange === 'week' ? 'Séries de trabalho nesta semana.' : 'Média semanal das últimas 4 semanas.'} />
        <div className="tile">
          <SegmentedControl label="Período do mapa muscular" value={muscleRange} onChange={setMuscleRange} options={[{ value: 'week', label: 'Semana' }, { value: 'month', label: 'Mês' }]} className="mb-7" />
          <MuscleMap
            sets={muscleScale}
            details={muscleDetails}
            targets={muscleTargets}
            periodLabel={muscleRange === 'week' ? 'nesta semana' : 'nas últimas 4 semanas'}
            weeks={muscleRange === 'week' ? 1 : 4}
          />
          <p className="footnote mt-4 text-[var(--muted)]">Aquecimentos não contam. Músculos secundários contam meia série; exercícios de corpo inteiro, meia série para cada músculo.</p>
        </div>
      </section>

      <section id="volume-semanal" aria-labelledby="volume-title" className="stack-section scroll-mt-20">
        <SectionHeader
          id="volume-title"
          title="Volume semanal."
          subtitle="Séries de trabalho por músculo e a faixa-alvo."
          action={<Link href="/settings#volume-muscular" className="link -mb-2.5 flex-none text-[17px]">Metas<ChevronRight size={17} aria-hidden /></Link>}
        />
        <div className="tile">
          <SegmentedControl label="Semana do volume" value={volumeWeek} onChange={setVolumeWeek} options={[{ value: 'current', label: 'Esta semana' }, { value: 'previous', label: 'Semana passada' }]} className="mb-6" />
          <MuscleVolumeBars rows={volumeRows} />
        </div>
      </section>

      <section aria-labelledby="consistency-title" className="stack-section">
        <SectionHeader id="consistency-title" title="Consistência." subtitle="Últimas 26 semanas." />
        <div className="tile">
          <div className="mb-6 grid grid-cols-2 gap-4">
            <div><p className="footnote text-[var(--muted)]">Dias ativos</p><p className="stat mt-1 text-[28px]">{activeDays26}</p></div>
            <div><p className="footnote text-[var(--muted)]">Maior sequência</p><p className="stat mt-1 text-[28px]">{longestStreak}<span className="stat-unit">{longestStreak === 1 ? 'dia' : 'dias'}</span></p></div>
          </div>
          <ConsistencyHeatmap setsByDay={dailySets} now={now} />
        </div>
      </section>

      <section aria-labelledby="calendar-title" className="stack-section">
        <SectionHeader
          id="calendar-title"
          title="Histórico."
          action={(
            <div className="-mb-1 -mr-2 flex items-center">
              <Button size="icon" variant="ghost" onClick={() => setCalendarMonth((month) => subMonths(month, 1))} aria-label="Mês anterior"><ChevronLeft size={22} aria-hidden /></Button>
              <Button size="icon" variant="ghost" onClick={() => setCalendarMonth((month) => addMonths(month, 1))} aria-label="Próximo mês"><ChevronRight size={22} aria-hidden /></Button>
            </div>
          )}
        />
        <div className="tile">
          <p className="title-3 mb-4 capitalize" aria-live="polite">{format(calendarMonth, 'MMMM yyyy', { locale: ptBR })}</p>
          <div aria-hidden className="caption grid grid-cols-7 text-center font-semibold text-[var(--muted)]">
            {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((day, index) => <span key={`${day}-${index}`} className="py-1">{day}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-y-1">
            {calendarDays.map((day) => {
              const key = format(day, 'yyyy-MM-dd')
              const count = sessionsByDay.get(key)?.length ?? 0
              const selected = isSameDay(day, selectedDate)
              const inMonth = isSameMonth(day, calendarMonth)
              const today = isSameDay(day, now)
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${format(day, "d 'de' MMMM", { locale: ptBR })}${count > 0 ? `, ${count} treino${count > 1 ? 's' : ''}` : ''}`}
                  onClick={() => setSelectedDate(day)}
                  className="flex h-12 flex-col items-center justify-center gap-1"
                  style={{ opacity: inMonth ? 1 : 0.3 }}
                >
                  <span className={`numeric flex h-8 w-8 items-center justify-center rounded-full text-[16px] ${selected ? 'bg-[var(--foreground)] font-semibold text-[var(--background-elevated)]' : today ? 'font-semibold text-[var(--accent)]' : ''}`}>
                    {format(day, 'd')}
                  </span>
                  <span aria-hidden className={`h-1 w-1 rounded-full ${count > 0 ? 'bg-[var(--data-1)]' : 'bg-transparent'}`} />
                </button>
              )
            })}
          </div>

          <div className="mt-5 border-t border-[var(--separator)] pt-5" aria-live="polite">
            <p className="footnote font-semibold text-[var(--muted)]">{format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase())}</p>
            {selectedSessions.length > 0 ? (
              <ul className="mt-3 space-y-4">
                {selectedSessions.map((session) => {
                  const setTotal = session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0)
                  const exerciseList = session.exercises.map((exercise) => exerciseNames.get(exercise.exerciseId)).filter(Boolean).slice(0, 4).join(', ')
                  return (
                    <li key={session.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="headline truncate">{workoutNames.get(session.workoutId) ?? 'Treino'}</p>
                          <p className="footnote numeric mt-0.5 text-[var(--muted)]">{setTotal} séries · {formatDuration(session.duration)}</p>
                        </div>
                        <span className="stat flex-none text-[20px]">{formatVolume(session.totalVolume)}</span>
                      </div>
                      {exerciseList && <p className="footnote mt-1 line-clamp-2 text-[var(--muted)]">{exerciseList}</p>}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="subhead mt-2 text-[var(--muted)]">Nenhum treino neste dia.</p>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="recap-title" className="stack-section">
        <h2 id="recap-title" className="sr-only">Retrospectivas</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link href={`/recap?month=${format(subMonths(now, 1), 'yyyy-MM')}`} className="tile tile-dark tile-link tile-compact block min-h-[150px]">
            <p className="eyebrow !text-[#ff8a3d]">Retrospectiva</p>
            <p className="title-3 mt-1 capitalize text-[#f5f5f7]">{format(subMonths(now, 1), 'MMMM', { locale: ptBR })}</p>
            <ChevronRight size={20} className="absolute bottom-5 right-5 text-[#2997ff]" aria-hidden />
          </Link>
          <Link href={`/recap?year=${now.getFullYear()}`} className="tile tile-dark tile-link tile-compact block min-h-[150px]">
            <p className="eyebrow !text-[#ff8a3d]">Seu ano</p>
            <p className="title-3 mt-1 text-[#f5f5f7]">{now.getFullYear()}</p>
            <ChevronRight size={20} className="absolute bottom-5 right-5 text-[#2997ff]" aria-hidden />
          </Link>
        </div>
      </section>

      <section aria-labelledby="awards-title" className="stack-section">
        <SectionHeader id="awards-title" title="Prêmios." action={<Link href="/achievements" className="link -mb-2.5 text-[17px]">{unlockedIds.size} de {ACHIEVEMENTS.length}<ChevronRight size={17} aria-hidden /></Link>} />
        <div className="list">
          {nextAchievements.map((achievement) => (
            <div key={achievement.id} className="grouped-row sep-inset-72 flex items-center gap-4 px-5 py-3.5">
              <AchievementIcon icon={achievement.icon} color={achievement.color} size={20} className="h-11 w-11 rounded-full" />
              <div className="min-w-0 flex-1">
                <p className="headline">{achievement.title}</p>
                <p className="footnote text-[var(--muted)]">{achievement.description}</p>
              </div>
            </div>
          ))}
          {nextAchievements.length === 0 && <p className="subhead p-6 text-center text-[var(--muted)]">Todos os prêmios foram conquistados.</p>}
        </div>
      </section>

      <section aria-labelledby="alltime-title" className="stack-section">
        <p id="alltime-title" className="list-header">Todos os tempos</p>
        <dl className="list">
          {[
            { label: 'Treinos', value: `${finished.length}` },
            { label: 'Volume total', value: formatVolume(allTimeVolume) },
            { label: 'Tempo total', value: formatDuration(finished.reduce((total, session) => total + session.duration, 0)) },
            { label: 'Média por treino', value: finished.length > 0 ? formatVolume(allTimeVolume / finished.length) : '—' },
          ].map((item) => (
            <div key={item.label} className="grouped-row flex min-h-12 items-center justify-between px-5 py-3">
              <dt>{item.label}</dt>
              <dd className="numeric text-[var(--muted)]">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
