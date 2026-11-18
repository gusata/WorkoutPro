'use client'

import { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Play, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useUndoToast } from '@/components/ui/UndoToast'
import { SortablePlan } from '@/components/training/SortablePlan'
import { WorkoutBadge, WorkoutTitle } from '@/components/training/WorkoutBadge'
import { haptic } from '@/lib/haptics'
import { Modal } from '@/components/ui/Modal'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { LibraryPicker } from '@/components/library/LibraryPicker'
import { LocalNav, SectionHeader } from '@/components/layout/PageHeader'
import { useProfileStore } from '@/stores/useProfileStore'
import { useSessionStore } from '@/stores/useSessionStore'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { exerciseMatches } from '@/lib/training'
import { formatDate, formatVolume } from '@/lib/utils'
import type { LibraryExercise } from '@/lib/exerciseLibrary'
import type { Exercise, WorkoutExerciseConfig } from '@/types'

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const WEEKDAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

function WorkoutDetail() {
  const router = useRouter()
  const id = useSearchParams().get('id') ?? ''
  const workouts = useWorkoutStore((state) => state.workouts)
  const exercises = useWorkoutStore((state) => state.exercises)
  const updateWorkout = useWorkoutStore((state) => state.updateWorkout)
  const addExerciseToWorkout = useWorkoutStore((state) => state.addExerciseToWorkout)
  const addLibraryExercise = useWorkoutStore((state) => state.addLibraryExercise)
  const removeExerciseFromWorkout = useWorkoutStore((state) => state.removeExerciseFromWorkout)
  const reorderExercises = useWorkoutStore((state) => state.reorderExercises)
  const sessions = useProfileStore((state) => state.sessions)
  const startSession = useSessionStore((state) => state.startSession)
  const workout = workouts.find((item) => item.id === id)
  const workoutExercises = useMemo(
    () => (workout?.exerciseIds.map((exerciseId) => exercises.find((item) => item.id === exerciseId)).filter((item): item is Exercise => Boolean(item)) ?? []),
    [exercises, workout]
  )
  const undo = useUndoToast()
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [addSource, setAddSource] = useState<'mine' | 'library'>('mine')
  const workoutLibraryIds = useMemo(() => new Set(workoutExercises.flatMap((exercise) => exercise.libraryId ? [exercise.libraryId] : [])), [workoutExercises])
  const recent = useMemo(() => sessions.filter((session) => session.workoutId === id && session.finishedAt).sort((a, b) => new Date(b.finishedAt!).getTime() - new Date(a.finishedAt!).getTime()).slice(0, 5), [id, sessions])

  if (!workout) return <div className="apple-page page-narrow pt-24"><p className="subhead text-center text-[var(--muted)]">Treino não encontrado.</p></div>

  const muscles = [...new Set(workoutExercises.map((exercise) => exercise.muscleGroup))]
  const totalSets = workoutExercises.reduce((total, exercise) => total + configFor(exercise.id).targetSets, 0)
  const days = workout.scheduledWeekdays ?? []

  function configFor(exerciseId: string): WorkoutExerciseConfig {
    return workout!.exerciseConfigs?.find((item) => item.exerciseId === exerciseId) ?? { exerciseId, targetSets: 3, minReps: 8, maxReps: 12, restSeconds: 90, supersetId: null, progression: { type: 'double-progression', increment: 2.5, minimumRir: 1 } }
  }

  async function changeConfig(exerciseId: string, updates: Partial<WorkoutExerciseConfig>) {
    const configs = workout!.exerciseIds.map((currentId) => currentId === exerciseId ? { ...configFor(currentId), ...updates } : configFor(currentId))
    await updateWorkout(id, { exerciseConfigs: configs })
  }

  async function addFromLibrary(item: LibraryExercise) {
    const exerciseId = await addLibraryExercise(item.id)
    await addExerciseToWorkout(id, exerciseId)
  }

  async function start() { await startSession(workout!, workoutExercises); router.push('/workouts/execute') }
  async function toggleSuperset(exerciseId: string, index: number) {
    const config = configFor(exerciseId)
    if (config.supersetId) return changeConfig(exerciseId, { supersetId: null })
    // Links with the exercise above (or below, for the first one), joining its group if it has one.
    const neighbor = workoutExercises[index === 0 ? 1 : index - 1]
    if (!neighbor) return changeConfig(exerciseId, { supersetId: `superset-${exerciseId}` })
    const groupId = configFor(neighbor.id).supersetId ?? `superset-${neighbor.id}`
    const configs = workout!.exerciseIds.map((currentId) => currentId === exerciseId || currentId === neighbor.id ? { ...configFor(currentId), supersetId: groupId } : configFor(currentId))
    haptic('light')
    await updateWorkout(id, { exerciseConfigs: configs })
  }

  async function removeWithUndo(exercise: Exercise) {
    const previousIds = [...workout!.exerciseIds]
    const previousConfigs = workout!.exerciseIds.map((currentId) => configFor(currentId))
    haptic('warning')
    await removeExerciseFromWorkout(id, exercise.id)
    undo.show(`${exercise.name} removido`, () => updateWorkout(id, { exerciseIds: previousIds, exerciseConfigs: previousConfigs }))
  }
  function toggleDay(day: number) {
    const next = days.includes(day) ? days.filter((item) => item !== day) : [...days, day].sort((a, b) => a - b)
    void updateWorkout(id, { scheduledWeekdays: next })
  }

  return (
    <div className="apple-page page-content">
      <LocalNav
        title={workout.name}
        back="/workouts"
        actions={<button type="button" onClick={start} disabled={workoutExercises.length === 0} className="pill"><Play size={12} fill="currentColor" aria-hidden />Iniciar</button>}
      />

      <header className="hero">
        <WorkoutBadge id={workout.id} name={workout.name} color={workout.color} size={72} />
        <p className="eyebrow-muted mt-6">Rotina</p>
        <h1 className="display mt-1"><WorkoutTitle id={workout.id}>{workout.name}</WorkoutTitle></h1>
        <p className="lede mt-3">{workoutExercises.length} exercícios · {totalSets} séries{muscles.length ? ` · ${muscles.slice(0, 3).join(', ')}` : ''}</p>
        <Button size="lg" className="mt-7" onClick={start} disabled={workoutExercises.length === 0}><Play size={15} fill="currentColor" aria-hidden />Começar treino</Button>
      </header>

      <section aria-labelledby="schedule-title" className="stack-section">
        <SectionHeader id="schedule-title" title="Agenda." subtitle="Dias deste treino. Usados nos lembretes e na tela Hoje." />
        <div className="tile tile-compact grid grid-cols-7 gap-1.5" role="group" aria-label="Dias da semana">
          {WEEKDAYS.map((day, index) => (
            <button
              key={index}
              type="button"
              aria-pressed={days.includes(index)}
              aria-label={WEEKDAY_NAMES[index]}
              onClick={() => toggleDay(index)}
              className={`h-11 rounded-full text-[15px] font-semibold transition-colors ${days.includes(index) ? 'bg-[var(--foreground)] text-[var(--background-elevated)]' : 'bg-[var(--fill)]'}`}
            >
              {day}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="plan-title" className="stack-section">
        <SectionHeader id="plan-title" title="Plano." action={<button type="button" onClick={() => setAdding(true)} className="link -mb-2.5 text-[17px]"><Plus size={17} aria-hidden />Adicionar</button>} />
        {workoutExercises.length > 1 && <p className="footnote -mt-1 mb-3 px-1 text-[var(--muted)]">Arraste pela alça para reordenar. Deslize para a esquerda para remover.</p>}
        {workoutExercises.length > 0
          ? (
            <SortablePlan
              exercises={workoutExercises}
              configFor={configFor}
              onReorder={(order) => void reorderExercises(id, order)}
              onChangeConfig={(exerciseId, updates) => void changeConfig(exerciseId, updates)}
              onToggleSuperset={(exerciseId, index) => void toggleSuperset(exerciseId, index)}
              onRemove={(exercise) => void removeWithUndo(exercise)}
            />
          )
          : <div className="list"><p className="subhead p-8 text-center text-[var(--muted)]">Adicione exercícios para começar.</p></div>}
      </section>

      <section aria-labelledby="recent-title" className="stack-section">
        <SectionHeader id="recent-title" title="Histórico." />
        <div className="list">
          {recent.map((session) => (
            <div key={session.id} className="grouped-row flex items-center gap-3 px-5 py-3.5">
              <div className="flex-1">
                <p className="headline">{formatDate(new Date(session.finishedAt!))}</p>
                <p className="footnote text-[var(--muted)]">{Math.round(session.duration / 60)} min · +{session.xpEarned} XP</p>
              </div>
              <span className="stat text-[20px]">{formatVolume(session.totalVolume)}</span>
            </div>
          ))}
          {recent.length === 0 && <p className="subhead p-8 text-center text-[var(--muted)]">Seu primeiro registro aparecerá aqui.</p>}
        </div>
      </section>

      {undo.toast}

      <Modal open={adding} onClose={() => setAdding(false)} title="Adicionar exercício">
        <SegmentedControl label="Origem do exercício" value={addSource} onChange={setAddSource} options={[{ value: 'mine', label: 'Meus exercícios' }, { value: 'library', label: 'Biblioteca' }]} className="mb-4" />
        {addSource === 'library' ? (
          <LibraryPicker inSheet addedIds={workoutLibraryIds} onAdd={addFromLibrary} addLabel="Adicionar ao treino" addedLabel="No treino" />
        ) : (<>
        <label className="relative mb-3 block">
          <span className="sr-only">Buscar exercício</span>
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="field field-filled !pl-11" placeholder="Buscar exercício" />
        </label>
        <div className="list max-h-80 overflow-y-auto !bg-[var(--fill)]">
          {exercises.filter((exercise) => !workout.exerciseIds.includes(exercise.id) && exerciseMatches(exercise.name, query)).map((exercise) => (
            <button type="button" key={exercise.id} onClick={async () => { await addExerciseToWorkout(id, exercise.id); setAdding(false) }} className="grouped-row flex min-h-14 w-full items-center px-4 py-3 text-left" aria-label={`Adicionar ${exercise.name}`}>
              <span className="flex-1"><span className="block">{exercise.name}</span><span className="footnote text-[var(--muted)]">{exercise.muscleGroup}</span></span>
              <Plus size={17} className="text-[var(--accent)]" aria-hidden />
            </button>
          ))}
        </div>
        </>)}
      </Modal>
    </div>
  )
}

export default function WorkoutDetailPage() { return <Suspense fallback={null}><WorkoutDetail /></Suspense> }
