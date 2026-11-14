'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Link2, Play, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DecimalInput } from '@/components/ui/DecimalInput'
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
  const [expanded, setExpanded] = useState<string | null>(null)
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
  function move(exerciseId: string, direction: -1 | 1) {
    const index = workout!.exerciseIds.indexOf(exerciseId); const next = index + direction
    if (next < 0 || next >= workout!.exerciseIds.length) return
    const order = [...workout!.exerciseIds]; const [item] = order.splice(index, 1); order.splice(next, 0, item); void reorderExercises(id, order)
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
        <p className="eyebrow-muted flex items-center gap-2"><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: workout.color }} />Rotina</p>
        <h1 className="display mt-1">{workout.name}</h1>
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
        <div className="list">
          {workoutExercises.map((exercise, index) => {
            const config = configFor(exercise.id); const open = expanded === exercise.id
            return (
              <div key={exercise.id} className="grouped-row">
                <div className="flex items-center gap-1 py-2 pl-5 pr-2">
                  <span aria-hidden className="numeric w-6 flex-none text-[15px] font-semibold text-[var(--muted)]">{index + 1}</span>
                  <button type="button" onClick={() => setExpanded(open ? null : exercise.id)} aria-expanded={open} className="flex min-h-14 min-w-0 flex-1 items-center gap-2 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="headline block truncate">{exercise.name}</span>
                      <span className="footnote text-[var(--muted)]">{config.targetSets} × {config.minReps}–{config.maxReps} · {config.restSeconds}s{config.supersetId ? ' · Supersérie' : ''}</span>
                    </span>
                    <ChevronDown size={17} aria-hidden className={`flex-none text-[var(--muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  <button type="button" onClick={() => move(exercise.id, -1)} disabled={index === 0} className="flex h-11 w-9 flex-none items-center justify-center text-[var(--muted)] disabled:opacity-20" aria-label={`Mover ${exercise.name} para cima`}><ArrowUp size={17} aria-hidden /></button>
                  <button type="button" onClick={() => move(exercise.id, 1)} disabled={index === workoutExercises.length - 1} className="flex h-11 w-9 flex-none items-center justify-center text-[var(--muted)] disabled:opacity-20" aria-label={`Mover ${exercise.name} para baixo`}><ArrowDown size={17} aria-hidden /></button>
                </div>
                {open && (
                  <div className="border-t border-[var(--separator)] bg-[var(--surface-2)] px-5 py-4">
                    <div className="grid grid-cols-4 gap-2">
                      <MiniNumber label="Séries" value={config.targetSets} onChange={(value) => void changeConfig(exercise.id, { targetSets: value })} />
                      <MiniNumber label="Mín." value={config.minReps} onChange={(value) => void changeConfig(exercise.id, { minReps: value })} />
                      <MiniNumber label="Máx." value={config.maxReps} onChange={(value) => void changeConfig(exercise.id, { maxReps: value })} />
                      <MiniNumber label="Pausa (s)" value={config.restSeconds} step={15} onChange={(value) => void changeConfig(exercise.id, { restSeconds: value })} />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => void changeConfig(exercise.id, { supersetId: config.supersetId ? null : `superset-${Math.max(0, index - 1)}` })} aria-pressed={Boolean(config.supersetId)} className="chip"><Link2 size={15} aria-hidden />Supersérie</button>
                      <Link href={`/exercises/detail?id=${exercise.id}`} className="link px-2 text-[15px]">Histórico e força<ChevronRight size={15} aria-hidden /></Link>
                      <button type="button" onClick={() => void removeExerciseFromWorkout(id, exercise.id)} className="ml-auto flex min-h-11 items-center gap-1 rounded-full px-2 text-[15px] text-[var(--danger)]"><Trash2 size={15} aria-hidden />Remover</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {workoutExercises.length === 0 && <p className="subhead p-8 text-center text-[var(--muted)]">Adicione exercícios para começar.</p>}
        </div>
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

function MiniNumber({ label, value, step = 1, onChange }: { label: string; value: number; step?: number; onChange: (value: number) => void }) {
  return (
    <label>
      <span className="caption mb-1 block font-semibold text-[var(--muted)]">{label}</span>
      <DecimalInput integer min={1} value={value} onValueChange={onChange} title={step > 1 ? `Em passos de ${step}` : undefined} className="set-field !bg-[var(--surface)]" />
    </label>
  )
}

export default function WorkoutDetailPage() { return <Suspense fallback={null}><WorkoutDetail /></Suspense> }
