'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { BookOpen, CalendarCheck, ChevronRight, Clock3, MoreHorizontal, Pencil, Play, Plus, Trash2, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Hero, LocalNav } from '@/components/layout/PageHeader'
import { TrainingBlockCard } from '@/components/training/TrainingBlockCard'
import { useProfileStore } from '@/stores/useProfileStore'
import { useSessionStore } from '@/stores/useSessionStore'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { SwipeRow } from '@/components/ui/SwipeRow'
import { WorkoutBadge, WorkoutTitle, calendarDaysBetween, relativeDay, workoutColorVars } from '@/components/training/WorkoutBadge'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/cn'
import type { Exercise, Workout } from '@/types'

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const WEEKDAY_LETTER = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

/** Rough session length: ~40s per set of work plus the configured rest. */
function estimateMinutes(workout: Workout) {
  const configs = new Map((workout.exerciseConfigs ?? []).map((config) => [config.exerciseId, config]))
  const seconds = workout.exerciseIds.reduce((total, id) => {
    const config = configs.get(id)
    const sets = config?.targetSets ?? 3
    return total + sets * (40 + (config?.restSeconds ?? 90))
  }, 0)
  return Math.max(5, Math.round(seconds / 60 / 5) * 5)
}

function TodayCard({ workout, exerciseCount, minutes, doneToday, disabled, onStart }: {
  workout: Workout
  exerciseCount: number
  minutes: number
  doneToday: boolean
  disabled: boolean
  onStart: () => void
}) {
  return (
    <section aria-label="Treino de hoje" className="today-card rise-in mt-6 p-6" style={workoutColorVars(workout.color)}>
      <p className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-white/80">
        <CalendarCheck size={14} aria-hidden />{doneToday ? 'Feito hoje' : 'Hoje'}
      </p>
      <div className="mt-3 flex items-center gap-4">
        <WorkoutBadge id={workout.id} name={workout.name} color="rgba(255,255,255,.22)" size={56} morph={false} className="!shadow-none ring-1 ring-white/30" />
        <div className="min-w-0 flex-1">
          <h2 className="title-1 truncate">{workout.name}</h2>
          <p className="subhead mt-0.5 flex items-center gap-1.5 text-white/85">
            {exerciseCount} exercícios<span aria-hidden>·</span><Clock3 size={14} aria-hidden />~{minutes} min
          </p>
        </div>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { haptic('medium'); onStart() }}
        className="pressable relative z-[1] mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-[17px] font-semibold text-[#1d1d1f] disabled:opacity-60"
        aria-label={`Iniciar ${workout.name} agora`}
      >
        <Play size={16} fill="currentColor" aria-hidden />{doneToday ? 'Treinar de novo' : 'Começar agora'}
      </button>
    </section>
  )
}

export default function WorkoutsPage() {
  const router = useRouter()
  const workouts = useWorkoutStore((state) => state.workouts)
  const exercises = useWorkoutStore((state) => state.exercises)
  const deleteWorkout = useWorkoutStore((state) => state.deleteWorkout)
  const sessions = useProfileStore((state) => state.sessions)
  const active = useSessionStore((state) => state.active)
  const startSession = useSessionStore((state) => state.startSession)
  const [deleteTarget, setDeleteTarget] = useState<Workout | null>(null)
  const [startTarget, setStartTarget] = useState<Workout | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const today = new Date().getDay()
  // The first routine scheduled for today becomes the hero card.
  const todayWorkout = workouts.find((workout) => workout.scheduledWeekdays?.includes(today) && workout.exerciseIds.length > 0)

  const exerciseById = useMemo(() => new Map(exercises.map((item) => [item.id, item])), [exercises])
  const lastFinished = useMemo(() => {
    const map = new Map<string, Date>()
    for (const session of sessions) {
      if (!session.finishedAt) continue
      const date = new Date(session.finishedAt)
      const current = map.get(session.workoutId)
      if (!current || date > current) map.set(session.workoutId, date)
    }
    return map
  }, [sessions])

  useEffect(() => {
    if (!menu) return
    function onPointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement
      if (!menuRef.current?.contains(target) && !target.closest('[aria-haspopup="menu"]')) setMenu(null)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenu(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menu])

  async function doStart(workout: Workout) {
    if (starting) return
    setStarting(true)
    try {
      const selected = workout.exerciseIds.map((id) => exerciseById.get(id)).filter((item): item is Exercise => Boolean(item))
      await startSession(workout, selected)
      router.push('/workouts/execute')
    } finally {
      setStarting(false)
    }
  }

  function requestStart(workout: Workout) {
    if (active) setStartTarget(workout)
    else void doStart(workout)
  }

  return (
    <div className="apple-page page-content">
      <LocalNav
        title="Treinos"
        actions={<Link href="/workouts/new" className="pill" aria-label="Criar treino"><Plus size={14} strokeWidth={2.4} aria-hidden />Novo</Link>}
      />

      <Hero
        eyebrow="Biblioteca"
        title="Treinos."
        lede={workouts.length === 0
          ? 'Monte sua primeira rotina ou parta de um modelo pronto.'
          : `${workouts.length} ${workouts.length === 1 ? 'rotina pronta' : 'rotinas prontas'} para começar.`}
      />

      {active && (
        <Link href="/workouts/execute" className="tile tile-compact tile-link mt-6 flex items-center gap-4">
          <span aria-hidden className="live-dot h-2.5 w-2.5 flex-none rounded-full bg-[var(--success-fill)]" />
          <span className="min-w-0 flex-1">
            <span className="footnote block font-semibold text-[var(--success)]">Em andamento</span>
            <span className="headline block truncate">{active.workoutName}</span>
          </span>
          <span className="link flex-none">Abrir<ChevronRight size={17} aria-hidden /></span>
        </Link>
      )}

      {todayWorkout && (
        <TodayCard
          workout={todayWorkout}
          exerciseCount={todayWorkout.exerciseIds.length}
          minutes={estimateMinutes(todayWorkout)}
          doneToday={(() => { const last = lastFinished.get(todayWorkout.id); return Boolean(last && calendarDaysBetween(last) === 0) })()}
          disabled={starting}
          onStart={() => requestStart(todayWorkout)}
        />
      )}

      <section aria-labelledby="routines-title" className="stack-section">
        <h2 id="routines-title" className="section-title mb-4 px-1">Minhas rotinas.</h2>
        {workouts.length > 0 && <p className="footnote -mt-2 mb-4 px-1 text-[var(--muted)]">Deslize um card para a esquerda para editar ou excluir.</p>}
        <ul className="space-y-3">
          {workouts.map((workout, index) => {
            const last = lastFinished.get(workout.id)
            const menuOpen = menu === workout.id
            const muscles = [...new Set(workout.exerciseIds.map((id) => exerciseById.get(id)?.muscleGroup).filter(Boolean))].slice(0, 3)
            const days = new Set(workout.scheduledWeekdays ?? [])
            const idle = last ? calendarDaysBetween(last) : null
            const stale = idle !== null && idle >= 10
            return (
              <li key={workout.id} className={cn('stagger-in', menuOpen ? 'relative z-30' : 'relative')} style={{ '--i': index } as CSSProperties}>
                <SwipeRow
                  className="rounded-[var(--radius-xl)]"
                  contentClassName="!bg-transparent"
                  actions={[
                    { label: 'Excluir', icon: <Trash2 size={18} aria-hidden />, tone: 'danger', onAction: () => setDeleteTarget(workout) },
                    { label: 'Editar', icon: <Pencil size={18} aria-hidden />, tone: 'neutral', onAction: () => router.push(`/workouts/detail?id=${workout.id}`) },
                  ]}
                >
                  <div className="workout-card relative flex transition-transform duration-200 active:scale-[0.985] gap-4 py-5 pl-5 pr-3" style={workoutColorVars(workout.color)}>
                    <Link href={`/workouts/detail?id=${workout.id}`} className="absolute inset-0 z-[1] rounded-[var(--radius-xl)]" aria-label={`Abrir ${workout.name}`} draggable={false} />
                    <WorkoutBadge id={workout.id} name={workout.name} color={workout.color} size={48} className="relative z-[2] pointer-events-none" />
                    <div className="pointer-events-none relative z-[2] min-w-0 flex-1">
                      <WorkoutTitle id={workout.id} className="title-3 truncate">{workout.name}</WorkoutTitle>
                      <p className="footnote mt-0.5 truncate text-[var(--muted)]">
                        {workout.exerciseIds.length} exercícios · ~{estimateMinutes(workout)} min
                      </p>
                      {muscles.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {muscles.map((muscle) => <span key={muscle} className="muscle-chip">{muscle}</span>)}
                        </div>
                      )}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="week-dots" role="img" aria-label={days.size ? `Agendado: ${[...days].sort().map((day) => WEEKDAY_SHORT[day]).join(', ')}` : 'Sem dia fixo'}>
                          {WEEKDAY_LETTER.map((letter, day) => (
                            <span key={day} aria-hidden className="week-dot" data-on={days.has(day)} data-today={day === today}>{letter}</span>
                          ))}
                        </span>
                        <span className={cn('footnote flex-none font-medium', stale ? 'text-[var(--warning)]' : 'text-[var(--muted)]')}>{relativeDay(last)}</span>
                      </div>
                    </div>
                    <div className="relative z-[2] flex flex-none flex-col items-center gap-1 self-start">
                      <button
                        type="button"
                        disabled={starting}
                        onClick={() => { haptic('medium'); requestStart(workout) }}
                        className="pressable flex h-12 w-12 items-center justify-center rounded-full text-white shadow-[0_6px_16px_var(--wc-glow)] disabled:opacity-60"
                        style={{ background: workout.color }}
                        aria-label={`Iniciar ${workout.name}`}
                        data-no-swipe
                      >
                        <Play size={17} fill="currentColor" className="translate-x-[1px]" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => setMenu(menuOpen ? null : workout.id)}
                        className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--muted)]"
                        aria-label={`Mais opções de ${workout.name}`}
                        aria-expanded={menuOpen}
                        aria-haspopup="menu"
                        data-no-swipe
                      >
                        <MoreHorizontal size={20} aria-hidden />
                      </button>
                    </div>
                  </div>
                </SwipeRow>
                {menuOpen && (
                  <div ref={menuRef} role="menu" className="glass-panel toast-enter absolute right-3 top-[7.5rem] z-20 w-52 overflow-hidden rounded-2xl text-[var(--foreground)]">
                    <Link role="menuitem" href={`/workouts/detail?id=${workout.id}`} className="grouped-row flex min-h-12 items-center justify-between px-4 text-[17px]">
                      Editar rotina<Pencil size={17} aria-hidden />
                    </Link>
                    <button role="menuitem" type="button" onClick={() => { setDeleteTarget(workout); setMenu(null) }} className="grouped-row flex min-h-12 w-full items-center justify-between px-4 text-left text-[17px] text-[var(--danger)]">
                      Excluir<Trash2 size={17} aria-hidden />
                    </button>
                  </div>
                )}
              </li>
            )
          })}
          <li>
            <Link href="/workouts/new" className="tile tile-link flex items-center gap-4 !py-5 !pl-5">
              <span aria-hidden className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]"><Plus size={20} strokeWidth={2.2} /></span>
              <span className="min-w-0 flex-1">
                <span className="headline block">Nova rotina</span>
                <span className="footnote block text-[var(--muted)]">Do zero ou de um modelo pronto</span>
              </span>
              <ChevronRight size={18} className="flex-none text-[var(--muted)]" aria-hidden />
            </Link>
          </li>
          <li>
            <Link href="/workouts/generate" className="tile tile-link flex items-center gap-4 !py-5 !pl-5">
              <span aria-hidden className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]"><WandSparkles size={19} strokeWidth={2.2} /></span>
              <span className="min-w-0 flex-1">
                <span className="headline block">Gerar rotina</span>
                <span className="footnote block text-[var(--muted)]">Divisão completa pelos seus dias, objetivo e equipamentos</span>
              </span>
              <ChevronRight size={18} className="flex-none text-[var(--muted)]" aria-hidden />
            </Link>
          </li>
        </ul>
      </section>

      <Link href="/exercises/library" className="tile tile-link mt-3 flex items-center gap-4 !py-5 !pl-5">
        <span aria-hidden className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]"><BookOpen size={19} /></span>
        <span className="min-w-0 flex-1">
          <span className="headline block">Biblioteca de exercícios</span>
          <span className="footnote block text-[var(--muted)]">Execução, erros comuns e ilustrações</span>
        </span>
        <ChevronRight size={18} className="flex-none text-[var(--muted)]" aria-hidden />
      </Link>

      <TrainingBlockCard />

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Excluir treino">
        <p className="subhead mb-6 text-[var(--muted)]">Excluir <strong className="text-[var(--foreground)]">{deleteTarget?.name}</strong>? O histórico já registrado será mantido.</p>
        <div className="flex gap-3"><Button variant="secondary" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancelar</Button><Button variant="danger" className="flex-1" onClick={async () => { if (deleteTarget) await deleteWorkout(deleteTarget.id); setDeleteTarget(null) }}><Trash2 size={15} aria-hidden />Excluir</Button></div>
      </Modal>
      <Modal open={!!startTarget} onClose={() => setStartTarget(null)} title="Treino em andamento">
        <p className="subhead mb-6 text-[var(--muted)]">Descartar a sessão atual e iniciar <strong>{startTarget?.name}</strong>?</p>
        <div className="flex gap-3"><Button variant="secondary" className="flex-1" onClick={() => setStartTarget(null)}>Cancelar</Button><Button className="flex-1" onClick={() => { if (startTarget) void doStart(startTarget); setStartTarget(null) }}>Iniciar</Button></div>
      </Modal>
    </div>
  )
}
