'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Dumbbell, ChevronRight, Trash2, Play } from 'lucide-react'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { useSessionStore } from '@/stores/useSessionStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import type { Workout } from '@/types'

const GREEN = '#00c896'

function WorkoutCard({ workout, onDelete, onStart }: {
  workout: Workout
  onDelete: () => void
  onStart:  () => void
}) {
  const color = workout.color

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <Card className="overflow-hidden">
        {/* accent top bar */}
        <div className="h-[3px] w-full" style={{ background: color }} />
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-none"
              style={{ background: `${color}18` }}
            >
              <Dumbbell size={17} style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white text-sm">{workout.name}</h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                {workout.exerciseIds.length} exercício{workout.exerciseIds.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onDelete}
                className="rounded-lg p-2 text-zinc-700 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
              >
                <Trash2 size={13} />
              </button>
              <Link href={`/workouts/detail?id=${workout.id}`}>
                <button className="rounded-lg p-2 text-zinc-600 hover:text-white hover:bg-white/8 transition-all">
                  <ChevronRight size={15} />
                </button>
              </Link>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onStart}
            className="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-all"
            style={{
              background: `${GREEN}12`,
              color: GREEN,
              border: `1px solid ${GREEN}22`,
            }}
          >
            <Play size={13} />
            Iniciar Treino
          </motion.button>
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
  const [startTarget,  setStartTarget]  = useState<Workout | null>(null)

  function handleStartWorkout(workout: Workout) {
    if (active) { setStartTarget(workout) } else { doStart(workout) }
  }

  function doStart(workout: Workout) {
    const exs = workout.exerciseIds
      .map((id) => exercises.find((e) => e.id === id))
      .filter(Boolean) as typeof exercises
    startSession(workout, exs)
    router.push('/workouts/execute')
  }

  return (
    <div className="px-4 pt-14 pb-4 page-content max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-zinc-500">Seus</p>
          <h1 className="text-2xl font-bold text-white tracking-tight">Treinos</h1>
        </div>
        <Link href="/workouts/new">
          <Button size="sm">
            <Plus size={15} />
            Novo
          </Button>
        </Link>
      </div>

      {/* Active session banner */}
      {active && (
        <Link href="/workouts/execute">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-2xl p-4 flex items-center gap-3"
            style={{
              background: `${active.workoutColor}0e`,
              border: `1px solid ${active.workoutColor}28`,
            }}
          >
            <span className="w-2 h-2 rounded-full animate-pulse flex-none"
              style={{ background: active.workoutColor }}
            />
            <p className="text-sm font-semibold text-white flex-1">{active.workoutName} em andamento</p>
            <span className="text-xs text-zinc-500">Retomar →</span>
          </motion.div>
        </Link>
      )}

      {workouts.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
            style={{ background: `${GREEN}10`, border: `1px solid ${GREEN}18` }}
          >
            <Dumbbell size={30} style={{ color: GREEN }} />
          </div>
          <div>
            <p className="font-bold text-white text-lg">Nenhum treino ainda</p>
            <p className="text-sm text-zinc-500 mt-1">Crie seu primeiro treino para começar</p>
          </div>
          <Link href="/workouts/new">
            <Button>
              <Plus size={15} />
              Criar Treino
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {workouts.map((w) => (
              <WorkoutCard
                key={w.id}
                workout={w}
                onDelete={() => setDeleteTarget(w)}
                onStart={() => handleStartWorkout(w)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Delete confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Excluir treino">
        <p className="text-sm text-zinc-400 mb-6">
          Tem certeza que deseja excluir{' '}
          <strong className="text-white">{deleteTarget?.name}</strong>?{' '}
          Esta ação não pode ser desfeita.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={async () => {
              if (deleteTarget) {
                await deleteWorkout(deleteTarget.id)
                setDeleteTarget(null)
              }
            }}
          >
            <Trash2 size={15} />
            Excluir
          </Button>
        </div>
      </Modal>

      {/* Replace session */}
      <Modal open={!!startTarget} onClose={() => setStartTarget(null)} title="Treino em andamento">
        <p className="text-sm text-zinc-400 mb-6">
          Você tem um treino em andamento. Deseja descartá-lo e iniciar{' '}
          <strong className="text-white">{startTarget?.name}</strong>?
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setStartTarget(null)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => { if (startTarget) { doStart(startTarget); setStartTarget(null) } }}
          >
            <Play size={15} />
            Iniciar
          </Button>
        </div>
      </Modal>
    </div>
  )
}
