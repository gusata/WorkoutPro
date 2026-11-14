'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, MoreHorizontal, Pencil, Play, Plus, Trash2, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Hero, LocalNav } from '@/components/layout/PageHeader'
import { TrainingBlockCard } from '@/components/training/TrainingBlockCard'
import { useProfileStore } from '@/stores/useProfileStore'
import { useSessionStore } from '@/stores/useSessionStore'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { formatDate } from '@/lib/utils'
import type { Exercise, Workout } from '@/types'

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

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
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null)
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

      <section aria-labelledby="routines-title" className="stack-section">
        <h2 id="routines-title" className="section-title mb-4 px-1">Minhas rotinas.</h2>
        <ul className="space-y-3">
          {workouts.map((workout) => {
            const last = lastFinished.get(workout.id)
            const menuOpen = menu === workout.id
            const muscles = [...new Set(workout.exerciseIds.map((id) => exerciseById.get(id)?.muscleGroup).filter(Boolean))].slice(0, 3)
            const days = (workout.scheduledWeekdays ?? []).slice().sort((a, b) => a - b)
            return (
              <li key={workout.id} className={menuOpen ? 'relative z-30' : 'relative'}>
                <div className="tile relative flex items-center gap-4 !py-5 !pl-5 !pr-3">
                  <Link href={`/workouts/detail?id=${workout.id}`} className="absolute inset-0 z-[1] rounded-[var(--radius-xl)]" aria-label={`Abrir ${workout.name}`} />
                  <span aria-hidden className="h-12 w-1.5 flex-none rounded-full" style={{ background: workout.color }} />
                  <div className="pointer-events-none relative z-[2] min-w-0 flex-1">
                    <p className="title-3 truncate">{workout.name}</p>
                    <p className="footnote mt-1 truncate text-[var(--muted)]">
                      {workout.exerciseIds.length} exercícios{muscles.length ? ` · ${muscles.join(', ')}` : ''}
                    </p>
                    <p className="footnote mt-0.5 truncate text-[var(--muted)]">
                      {days.length ? days.map((day) => WEEKDAY_SHORT[day]).join(' · ') : 'Sem dia fixo'} · {last ? formatDate(last) : 'nunca feito'}
                    </p>
                  </div>
                  <div className="relative z-[2] flex flex-none items-center">
                    <button
                      type="button"
                      disabled={starting}
                      onClick={() => requestStart(workout)}
                      className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-fill)] text-white disabled:opacity-60"
                      aria-label={`Iniciar ${workout.name}`}
                    >
                      <Play size={16} fill="currentColor" className="translate-x-[1px]" aria-hidden />
                    </button>
                    <div ref={menuOpen ? menuRef : undefined} className="relative">
                      <button
                        type="button"
                        onClick={() => setMenu(menuOpen ? null : workout.id)}
                        className="flex h-11 w-10 items-center justify-center rounded-full text-[var(--muted)]"
                        aria-label={`Mais opções de ${workout.name}`}
                        aria-expanded={menuOpen}
                        aria-haspopup="menu"
                      >
                        <MoreHorizontal size={20} aria-hidden />
                      </button>
                      {menuOpen && (
                        <div role="menu" className="glass-panel absolute right-0 top-11 z-20 w-52 overflow-hidden rounded-2xl text-[var(--foreground)]">
                          <Link role="menuitem" href={`/workouts/detail?id=${workout.id}`} className="grouped-row flex min-h-12 items-center justify-between px-4 text-[17px]">
                            Editar rotina<Pencil size={17} aria-hidden />
                          </Link>
                          <button role="menuitem" type="button" onClick={() => { setDeleteTarget(workout); setMenu(null) }} className="grouped-row flex min-h-12 w-full items-center justify-between px-4 text-left text-[17px] text-[var(--danger)]">
                            Excluir<Trash2 size={17} aria-hidden />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
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
