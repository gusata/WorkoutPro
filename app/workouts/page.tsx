'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, Dumbbell, Play, Plus, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { useSessionStore } from '@/stores/useSessionStore'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import type { Workout } from '@/types'

function WorkoutCard({ workout, onStart, onDelete }: {
  workout: Workout
  onStart: () => void
  onDelete: () => void
}) {
  return (
    <Card glass pressable className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl text-white" style={{ background: workout.color }}>
          <Dumbbell size={20} />
        </div>
        <Link href={`/workouts/detail?id=${workout.id}`} className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-[var(--foreground)]">{workout.name}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">{workout.exerciseIds.length} exercicios</p>
        </Link>
        <button
          type="button"
          onClick={onDelete}
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-rose-500 transition-colors hover:bg-rose-500/10"
          aria-label="Excluir treino"
        >
          <Trash2 size={16} />
        </button>
        <ChevronRight size={18} className="mt-2 flex-none text-[var(--muted)]" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button onClick={onStart} className="w-full">
          <Play size={15} fill="currentColor" />
          Iniciar
        </Button>
        <Link href={`/workouts/detail?id=${workout.id}`}>
          <Button variant="secondary" className="w-full">Ajustar</Button>
        </Link>
      </div>
    </Card>
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
    const selectedExercises = workout.exerciseIds
      .map((id) => exercises.find((exercise) => exercise.id === id))
      .filter(Boolean) as typeof exercises

    await startSession(workout, selectedExercises)
    router.push('/workouts/execute')
  }

  return (
    <div className="apple-page page-content space-y-5 pb-28">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[var(--muted)]">Biblioteca</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--foreground)]">Treinos</h1>
        </div>
        <Link href="/workouts/new">
          <Button size="icon" aria-label="Novo treino">
            <Plus size={19} />
          </Button>
        </Link>
      </header>

      <Card glass className="p-5">
        <div className="flex items-center gap-4">
          <div className="soft-icon flex h-14 w-14 flex-none items-center justify-center rounded-2xl">
            <Sparkles size={24} />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-[var(--foreground)]">{workouts.length}</p>
            <p className="text-sm text-[var(--muted)]">
              rotinas salvas - {totalExercises} exercicios
            </p>
          </div>
        </div>
      </Card>

      {active && (
        <Link href="/workouts/execute">
          <Card glass pressable className="p-4">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 flex-none animate-pulse rounded-full" style={{ background: active.workoutColor }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[var(--foreground)]">Sessao ativa</p>
                <p className="truncate text-xs text-[var(--muted)]">{active.workoutName}</p>
              </div>
              <ChevronRight size={18} className="text-[var(--muted)]" />
            </div>
          </Card>
        </Link>
      )}

      {workouts.length === 0 ? (
        <Card glass className="p-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.8rem] bg-[var(--surface-2)] text-[var(--accent)]">
            <Dumbbell size={31} />
          </div>
          <h2 className="mt-5 text-xl font-bold text-[var(--foreground)]">Comece sua biblioteca</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-[var(--muted)]">
            Crie uma rotina do zero ou use um template pesquisado.
          </p>
          <Link href="/workouts/new" className="mt-5 inline-flex">
            <Button>
              <Plus size={16} />
              Criar treino
            </Button>
          </Link>
        </Card>
      ) : (
        <section>
          <h2 className="apple-section-title mb-3">Suas rotinas</h2>
          <div className="space-y-3">
            {workouts.map((workout) => (
              <WorkoutCard
                key={workout.id}
                workout={workout}
                onStart={() => handleStartWorkout(workout)}
                onDelete={() => setDeleteTarget(workout)}
              />
            ))}
          </div>
        </section>
      )}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Excluir treino">
        <p className="mb-6 text-sm text-[var(--muted)]">
          Excluir <strong className="text-[var(--foreground)]">{deleteTarget?.name}</strong>? Essa acao nao pode ser desfeita.
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
