'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import {
  ArrowLeft, Play, Plus, Trash2, Search, ChevronDown, ChevronUp, ArrowUp, ArrowDown
} from 'lucide-react'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { useSessionStore } from '@/stores/useSessionStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Input, Select, TextArea } from '@/components/ui/Input'
import { MUSCLE_GROUPS, formatVolume, formatDate } from '@/lib/utils'
import { getExerciseHistory, getExerciseRecords } from '@/lib/exerciseHistory'
import type { Exercise, WorkoutSession } from '@/types'

const GREEN  = '#00c896'
const INDIGO = '#6366f1'

interface ExerciseRowProps {
  ex: Exercise
  workoutColor: string
  sessions: WorkoutSession[]
  isOpen: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onToggle: () => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

function ExerciseRow({ ex, workoutColor, sessions, isOpen, canMoveUp, canMoveDown, onToggle, onRemove, onMoveUp, onMoveDown }: ExerciseRowProps) {
  const exSessions  = sessions.flatMap((s) => s.exercises.filter((se) => se.exerciseId === ex.id))
  const allSets     = exSessions.flatMap((se) => se.sets)
  const records = getExerciseRecords(getExerciseHistory(ex.id, sessions, []))
  const bestWeight  = allSets.length > 0 ? Math.max(...allSets.map((s) => s.weight)) : 0
  const bestVolume  = exSessions.length > 0
    ? Math.max(...exSessions.map((se) => se.sets.reduce((a, s) => a + s.weight * s.reps, 0)))
    : 0

  return (
    <div className="list-none">
      <Card>
        <div className="flex items-center">
          <div className="flex flex-col gap-1 pl-3 pr-1 py-3 flex-none">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              className="rounded-lg p-1 text-zinc-600 transition-colors disabled:opacity-25 hover:text-zinc-300"
              aria-label="Mover exercicio para cima"
            >
              <ArrowUp size={13} />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              className="rounded-lg p-1 text-zinc-600 transition-colors disabled:opacity-25 hover:text-zinc-300"
              aria-label="Mover exercicio para baixo"
            >
              <ArrowDown size={13} />
            </button>
          </div>

          {/* Expand button */}
          <button
            className="flex-1 pr-4 py-4 flex items-center gap-3 text-left min-w-0"
            onClick={onToggle}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-none text-sm"
              style={{ background: `${workoutColor}18`, color: workoutColor }}
            >
              💪
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm">{ex.name}</p>
              <p className="text-xs text-zinc-500">{ex.muscleGroup}</p>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href={`/exercises/detail?id=${ex.id}`}
                onClick={(e) => e.stopPropagation()}
                className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-bold text-[var(--accent)]"
              >
                PRs
              </Link>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove() }}
                className="p-1.5 rounded-lg text-zinc-700 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <Trash2 size={13} />
              </button>
              {isOpen
                ? <ChevronUp  size={15} className="text-zinc-500" />
                : <ChevronDown size={15} className="text-zinc-500" />}
            </div>
          </button>
        </div>

        {isOpen && (
          <div className="overflow-hidden">
            <div
              className="px-4 pb-4 grid grid-cols-2 gap-2 pt-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
            >
              {[
                { label: 'Melhor carga',  value: bestWeight > 0 ? `${bestWeight}kg` : '—' },
                { label: 'Melhor volume', value: bestVolume > 0 ? formatVolume(bestVolume) : '—' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-[11px] text-zinc-500">{item.label}</p>
                  <p className="font-bold text-white mt-0.5">{item.value}</p>
                </div>
              ))}
              <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-[11px] text-zinc-500">1RM estimado</p>
                <p className="font-bold text-white mt-0.5">
                  {records.bestEstimatedOneRm > 0 ? `${records.bestEstimatedOneRm.toFixed(1)}kg` : '---'}
                </p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-[11px] text-zinc-500">Sessoes</p>
                <p className="font-bold text-white mt-0.5">{records.sessions}</p>
              </div>
              {ex.notes && (
                <div className="col-span-2 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-[11px] text-zinc-500 mb-1">Observações</p>
                  <p className="text-xs text-zinc-300">{ex.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

function WorkoutDetail() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''
  const router = useRouter()

  const { workouts, exercises, addExercise, addExerciseToWorkout, removeExerciseFromWorkout, reorderExercises } = useWorkoutStore()
  const { startSession } = useSessionStore()
  const { sessions } = useProfileStore()

  const workout = workouts.find((w) => w.id === id)
  const workoutExercises = workout?.exerciseIds
    .map((eid) => exercises.find((e) => e.id === eid))
    .filter(Boolean) as Exercise[]

  const [showAddModal, setShowAddModal] = useState(false)
  const [showExModal,  setShowExModal]  = useState(false)
  const [exSearch, setExSearch] = useState('')
  const [exName,   setExName]   = useState('')
  const [exMuscle, setExMuscle] = useState(MUSCLE_GROUPS[0])
  const [exNotes,  setExNotes]  = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = exercises.filter(
    (e) => e.name.toLowerCase().includes(exSearch.toLowerCase()) && !workout?.exerciseIds.includes(e.id)
  )
  const workoutSessions = sessions.filter((s) => s.workoutId === id).slice(0, 5)

  if (!workout) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-zinc-500">Treino não encontrado</p>
      </div>
    )
  }

  async function handleStart() {
    await startSession(workout!, workoutExercises ?? [])
    router.push('/workouts/execute')
  }

  async function createAndAdd() {
    if (!exName.trim()) return
    const exId = await addExercise({ name: exName.trim(), muscleGroup: exMuscle, notes: exNotes })
    await addExerciseToWorkout(id, exId)
    setExName(''); setExNotes(''); setShowExModal(false)
  }

  function moveExercise(exerciseId: string, direction: -1 | 1) {
    const currentIndex = workout!.exerciseIds.indexOf(exerciseId)
    const nextIndex = currentIndex + direction
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= workout!.exerciseIds.length) return

    const nextOrder = [...workout!.exerciseIds]
    const [item] = nextOrder.splice(currentIndex, 1)
    nextOrder.splice(nextIndex, 0, item)
    reorderExercises(id, nextOrder)
  }

  return (
    <div className="px-4 pt-14 pb-28 page-content max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="rounded-xl p-2 text-zinc-400 hover:text-white transition-colors"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white tracking-tight">{workout.name}</h1>
          <p className="text-xs text-zinc-500">{workoutExercises?.length ?? 0} exercícios</p>
        </div>
        <Button onClick={handleStart}>
          <Play size={15} />
          Iniciar
        </Button>
      </div>

      {/* Color accent bar */}
      <div className="h-[3px] w-full rounded-full mb-5" style={{ background: workout.color }} />

      {/* Exercises — drag-to-reorder */}
      {workoutExercises?.length === 0 ? (
        <div className="py-8 text-center mb-5">
          <p className="text-sm text-zinc-600">Nenhum exercício adicionado</p>
        </div>
      ) : (
        <div className="space-y-2 mb-5">
          {workoutExercises?.map((ex, index) => (
            <ExerciseRow
              key={ex.id}
              ex={ex}
              workoutColor={workout.color}
              sessions={sessions}
              isOpen={expanded === ex.id}
              canMoveUp={index > 0}
              canMoveDown={index < workoutExercises.length - 1}
              onToggle={() => setExpanded(expanded === ex.id ? null : ex.id)}
              onRemove={() => removeExerciseFromWorkout(id, ex.id)}
              onMoveUp={() => moveExercise(ex.id, -1)}
              onMoveDown={() => moveExercise(ex.id, 1)}
            />
          ))}
        </div>
      )}

      <Button variant="outline" className="w-full mb-6" onClick={() => setShowAddModal(true)}>
        <Plus size={15} />
        Adicionar Exercício
      </Button>

      {/* Recent sessions */}
      {workoutSessions.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Histórico</h2>
          <div className="space-y-2">
            {workoutSessions.map((s) => (
              <Card key={s.id} className="p-3 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm text-white font-medium">
                    {s.finishedAt ? formatDate(new Date(s.finishedAt)) : 'Em andamento'}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatVolume(s.totalVolume)} · {s.exercises.reduce((a, e) => a + e.sets.length, 0)} séries
                  </p>
                </div>
                <Badge color={INDIGO}>+{s.xpEarned} XP</Badge>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Add exercise modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Adicionar Exercício">
        <div className="space-y-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              value={exSearch}
              onChange={(e) => setExSearch(e.target.value)}
              placeholder="Buscar exercício..."
              className="w-full h-10 rounded-xl pl-9 pr-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            />
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {filtered.map((e) => (
              <button
                key={e.id}
                onClick={async () => { await addExerciseToWorkout(id, e.id); setShowAddModal(false) }}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{e.name}</p>
                  <p className="text-xs text-zinc-500">{e.muscleGroup}</p>
                </div>
                <Plus size={13} className="text-zinc-600" />
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-zinc-600 text-center py-4">Nenhum exercício disponível</p>
            )}
          </div>
          <div className="pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button
              onClick={() => { setShowAddModal(false); setShowExModal(true) }}
              className="w-full text-sm flex items-center justify-center gap-2 py-2 transition-colors"
              style={{ color: GREEN }}
            >
              <Plus size={13} />
              Criar novo exercício
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showExModal} onClose={() => setShowExModal(false)} title="Novo Exercício">
        <div className="space-y-4">
          <Input label="Nome" placeholder="Ex: Supino Reto" value={exName} onChange={(e) => setExName(e.target.value)} />
          <Select
            label="Grupo muscular"
            value={exMuscle}
            onChange={(e) => setExMuscle(e.target.value as typeof exMuscle)}
            options={MUSCLE_GROUPS.map((g) => ({ value: g, label: g }))}
          />
          <TextArea label="Observações (opcional)" placeholder="Dicas de execução..." value={exNotes} onChange={(e) => setExNotes(e.target.value)} rows={2} />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowExModal(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={createAndAdd} disabled={!exName.trim()}>Criar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default function WorkoutDetailPage() {
  return (
    <Suspense fallback={null}>
      <WorkoutDetail />
    </Suspense>
  )
}
