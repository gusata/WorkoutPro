'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, Dumbbell, Layers3, Play, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { useSessionStore } from '@/stores/useSessionStore'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import type { Workout } from '@/types'

function WorkoutCard({
  workout,
  onDelete,
  onStart,
}: {
  workout: Workout
  onDelete: () => void
  onStart: () => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
    >
      <Card glass pressable className="p-4">
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl"
            style={{ background: `${workout.color}18`, color: workout.color }}
          >
            <Dumbbell size={20} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold text-[var(--foreground)]">{workout.name}</h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {workout.exerciseIds.length} exercicio{workout.exerciseIds.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault()
                    onDelete()
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-rose-500/10 hover:text-rose-500"
                  aria-label="Excluir treino"
                >
                  <Trash2 size={15} />
                </button>
                <Link href={`/workouts/detail?id=${workout.id}`} aria-label="Ver detalhes">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]">
                    <ChevronRight size={16} />
                  </span>
                </Link>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button className="flex-1" onClick={onStart}>
                <Play size={15} />
                Iniciar
              </Button>
              <Link href={`/workouts/detail?id=${workout.id}`} className="flex-1">
                <Button variant="secondary" className="w-full">
                  Ajustar
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

export default function WorkoutsPage() {
  const router = useRouter()
  const { workouts, exercises, deleteWorkout } = useWorkoutStore()
  const { active, startSession } = useSessionStore()
  const [deleteTarget, setDeleteTarget] = useState<Workout | null>(null)
  const [startTarget, setStartTarget] = useState<Workout | null>(null)

  const totalExercises = useMemo(
    () => workouts.reduce((total, workout) => total + workout.exerciseIds.length, 0),
    [workouts]
  )

  function handleStartWorkout(workout: Workout) {
    if (active) {
      setStartTarget(workout)
      return
    }
    void doStart(workout)
  }

  async function doStart(workout: Workout) {
    const selected = workout.exerciseIds
      .map((id) => exercises.find((exercise) => exercise.id === id))
      .filter(Boolean) as typeof exercises

    await startSession(workout, selected)
    router.push('/workouts/execute')
  }

  return (
    <div className="apple-page page-content space-y-5 pb-28">
      <header className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Biblioteca</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--foreground)]">Treinos</h1>
          </div>
          <Link href="/workouts/new">
            <Button size="icon" aria-label="Novo treino">
              <Plus size={19} />
            </Button>
          </Link>
        </div>

        <Card glass className="p-4">
          <div className="flex items-center gap-3">
            <div className="soft-icon flex h-11 w-11 items-center justify-center rounded-2xl">
              <Sparkles size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[var(--foreground)]">
                {workouts.length > 0 ? `${workouts.length} rotinas prontas` : 'Monte sua primeira rotina'}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {totalExercises} exercicios organizados para treinar sem friccao.
              </p>
            </div>
          </div>
        </Card>
      </header>

      {active && (
        <Link href="/workouts/execute">
          <Card glass className="p-4">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 flex-none rounded-full animate-pulse" style={{ background: active.workoutColor }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[var(--foreground)]">{active.workoutName} em andamento</p>
                <p className="text-xs text-[var(--muted)]">Toque para retomar a sessao</p>
              </div>
              <ChevronRight size={17} className="text-[var(--muted)]" />
            </div>
          </Card>
        </Link>
      )}

      {workouts.length === 0 ? (
        <Card glass className="px-5 py-12 text-center">
          <div className="soft-icon mx-auto flex h-20 w-20 items-center justify-center rounded-[28px]">
            <Dumbbell size={30} />
          </div>
          <h2 className="mt-5 text-lg font-bold text-[var(--foreground)]">Nenhum treino ainda</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-[var(--muted)]">
            Crie uma rotina com seus exercicios favoritos e acompanhe tudo por sessao.
          </p>
          <Link href="/workouts/new" className="mt-6 inline-flex">
            <Button>
              <Plus size={16} />
              Criar treino
            </Button>
          </Link>
        </Card>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Layers3 size={16} className="text-[var(--accent)]" />
            <h2 className="apple-section-title">Suas rotinas</h2>
          </div>
          <AnimatePresence mode="popLayout">
            {workouts.map((workout) => (
              <WorkoutCard
                key={workout.id}
                workout={workout}
                onDelete={() => setDeleteTarget(workout)}
                onStart={() => handleStartWorkout(workout)}
              />
            ))}
          </AnimatePresence>
        </section>
      )}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Excluir treino">
        <p className="mb-6 text-sm text-[var(--muted)]">
          Tem certeza que deseja excluir <strong className="text-[var(--foreground)]">{deleteTarget?.name}</strong>?
          Essa acao nao pode ser desfeita.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={async () => {
              if (!deleteTarget) return
              await deleteWorkout(deleteTarget.id)
              setDeleteTarget(null)
            }}
          >
            <Trash2 size={15} />
            Excluir
          </Button>
        </div>
      </Modal>

      <Modal open={!!startTarget} onClose={() => setStartTarget(null)} title="Treino em andamento">
        <p className="mb-6 text-sm text-[var(--muted)]">
          Existe uma sessao ativa. Deseja descarta-la e iniciar{' '}
          <strong className="text-[var(--foreground)]">{startTarget?.name}</strong>?
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setStartTarget(null)}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              if (!startTarget) return
              void doStart(startTarget)
              setStartTarget(null)
            }}
          >
            <Play size={15} />
            Iniciar
          </Button>
        </div>
      </Modal>
    </div>
  )
}
