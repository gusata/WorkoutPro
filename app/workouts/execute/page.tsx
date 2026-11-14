'use client'

import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Check, ChevronDown, Copy, Flame, Layers3, MoreHorizontal, NotebookPen, Play, Plus, Replace, Scale, Share, Timer, Trash2, Trophy, Video, X,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Button, buttonClasses } from '@/components/ui/Button'
import { DecimalInput } from '@/components/ui/DecimalInput'
import { Modal } from '@/components/ui/Modal'
import { RestPresetPicker, RestTimerOverlay } from '@/components/timer/RestTimer'
import { PlateCalculator } from '@/components/training/PlateCalculator'
import { VideoModal } from '@/components/training/MediaViewer'
import { ReadinessLoadNote, useReadinessSuggestion } from '@/components/health/ReadinessLoadNote'
import { useProfileStore } from '@/stores/useProfileStore'
import { useSessionStore } from '@/stores/useSessionStore'
import { useTimerStore } from '@/stores/useTimerStore'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { generateWarmupSets, getProgressionSuggestion, SET_TYPES } from '@/lib/training'
import { bestsByExercise, recordForSet, type ExerciseBest } from '@/lib/insights'
import { estimateOneRm, lastSetsForExercise } from '@/lib/exerciseHistory'
import { saveMedia } from '@/lib/media'
import { renderShareCard, shareImage } from '@/lib/shareCard'
import { averageHeartRate } from '@/lib/health'
import { DEFAULT_BAR_WEIGHT } from '@/lib/preferences'
import { formatDecimal, formatDuration, formatVolume } from '@/lib/utils'
import { cn } from '@/lib/cn'
import type { ActiveExercise, ActiveSession, ActiveSet, Exercise } from '@/types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Fits a 360px-wide phone: flexible weight/reps columns keep ~58px for values like "102,5".
const SET_GRID = 'grid grid-cols-[2.25rem_2.75rem_minmax(0,1fr)_minmax(0,1fr)_2.5rem_2.75rem] items-center gap-1'
const RECORD_EVENT = 'workoutpro:record'

interface SummaryData {
  workoutName: string
  startedAt: Date
  finishedAt: Date
  volume: number
  duration: number
  xp: number
  sets: number
  prs: number
}

interface RecordToastData {
  id: number
  exercise: string
  detail: string
}

const BestsContext = createContext<Map<string, ExerciseBest>>(new Map())

export default function ExecutePage() {
  const router = useRouter()
  const active = useSessionStore((state) => state.active)
  const endSession = useSessionStore((state) => state.endSession)
  const discardSession = useSessionStore((state) => state.discardSession)
  const replaceExercise = useSessionStore((state) => state.replaceExercise)
  const exercises = useWorkoutStore((state) => state.exercises)
  const sessions = useProfileStore((state) => state.sessions)
  const barWeight = useProfileStore((state) => state.profile?.preferences?.barWeight ?? DEFAULT_BAR_WEIGHT)
  const reloadProfile = useProfileStore((state) => state.load)
  const { workoutRunning, workoutStartedAt, startWorkoutTimer } = useTimerStore(
    useShallow((state) => ({ workoutRunning: state.workoutRunning, workoutStartedAt: state.workoutStartedAt, startWorkoutTimer: state.startWorkoutTimer }))
  )
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [optionsFor, setOptionsFor] = useState<string | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [platesFor, setPlatesFor] = useState<{ name: string; weight: number } | null>(null)
  const [replaceFor, setReplaceFor] = useState<string | null>(null)
  const [videoFor, setVideoFor] = useState<{ exerciseId: string; setId: string } | null>(null)
  const [playing, setPlaying] = useState<{ id: string; title: string } | null>(null)
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [record, setRecord] = useState<RecordToastData | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const videoInput = useRef<HTMLInputElement>(null)

  // Records are compared with the history before this session.
  const bests = useMemo(() => bestsByExercise(sessions, active?.sessionId), [active?.sessionId, sessions])

  useEffect(() => {
    if (!active && !summary && !finishing) router.replace('/workouts')
    if (!active) return
    const startedAt = new Date(active.startedAt).getTime()
    if (!workoutRunning || workoutStartedAt !== startedAt) startWorkoutTimer(startedAt)
  }, [active, finishing, router, startWorkoutTimer, summary, workoutRunning, workoutStartedAt])

  useEffect(() => {
    function onRecord(event: Event) {
      const detail = (event as CustomEvent<Omit<RecordToastData, 'id'>>).detail
      setRecord({ ...detail, id: Date.now() })
      if ('vibrate' in navigator) navigator.vibrate?.([30, 60, 30, 60, 120])
    }
    window.addEventListener(RECORD_EVENT, onRecord)
    return () => window.removeEventListener(RECORD_EVENT, onRecord)
  }, [])

  useEffect(() => {
    if (!record) return
    const timer = setTimeout(() => setRecord(null), 4200)
    return () => clearTimeout(timer)
  }, [record])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 3500)
    return () => clearTimeout(timer)
  }, [notice])

  useLiveStatus(active)

  const totals = useMemo(() => {
    const sets = active?.exercises.flatMap((item) => item.sets) ?? []
    const done = sets.filter((item) => item.completed)
    return { all: sets.length, done: done.length, volume: done.reduce((sum, item) => sum + item.weight * item.reps, 0) }
  }, [active])

  const toggleCollapsed = useCallback((exerciseId: string) => {
    setCollapsed((state) => ({ ...state, [exerciseId]: !state[exerciseId] }))
  }, [])
  const toggleOptions = useCallback((exerciseId: string) => {
    setOptionsFor((current) => (current === exerciseId ? null : exerciseId))
  }, [])
  const openReplace = useCallback((exerciseId: string) => {
    setReplaceFor(exerciseId)
    setOptionsFor(null)
  }, [])
  const openPlates = useCallback((name: string, weight: number) => {
    setPlatesFor({ name, weight })
    setOptionsFor(null)
  }, [])
  const openVideo = useCallback((exerciseId: string, setId: string) => {
    setVideoFor({ exerciseId, setId })
    setOptionsFor(null)
    videoInput.current?.click()
  }, [])
  const playVideo = useCallback((id: string, title: string) => setPlaying({ id, title }), [])

  if (summary) return <Summary summary={summary} onClose={() => router.replace('/dashboard')} />
  if (!active) return null

  function finishRequest() {
    if (totals.done < totals.all) setFinishOpen(true)
    else void finish()
  }

  async function finish() {
    if (!active) return
    setFinishing(true)
    const workoutName = active.workoutName
    try {
      const session = await endSession()
      if (session) {
        await reloadProfile()
        const sets = session.exercises.reduce((total, item) => total + item.sets.length, 0)
        setSummary({
          workoutName,
          startedAt: new Date(session.startedAt),
          finishedAt: new Date(session.finishedAt ?? Date.now()),
          volume: session.totalVolume, duration: session.duration, xp: session.xpEarned, sets, prs: session.newPrs,
        })
      }
    } finally {
      setFinishing(false)
      setFinishOpen(false)
    }
  }

  async function onVideoPicked(file: File | undefined) {
    const target = videoFor
    setVideoFor(null)
    if (!file || !target || !active) return
    try {
      const item = await saveMedia(file, 'video', { sessionId: active.sessionId, exerciseId: target.exerciseId, setId: target.setId })
      useSessionStore.getState().updateSet(target.exerciseId, target.setId, { videoId: item.id })
      setNotice('Vídeo salvo neste aparelho.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível salvar o vídeo.')
    }
  }

  const progress = totals.all ? Math.round((totals.done / totals.all) * 100) : 0
  const replacing = active.exercises.find((item) => item.exerciseId === replaceFor)

  return (
    <BestsContext.Provider value={bests}>
      <div className="apple-page page-content !pb-48">
        <header className="local-nav" data-scrolled="true">
          <div className="local-nav-inner">
            <button type="button" onClick={() => setDiscardOpen(true)} className="-ml-2 flex h-11 w-11 flex-none items-center justify-center rounded-full text-[var(--muted)]" aria-label="Sair do treino">
              <X size={22} aria-hidden />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="headline truncate">{active.workoutName}</h1>
              <p className="footnote numeric flex gap-3 text-[var(--muted)]">
                <WorkoutClock />
                <span>{formatVolume(totals.volume)}</span>
              </p>
            </div>
            <div className="text-right">
              <strong className="stat block text-[22px]">{totals.done}<span className="text-[15px] text-[var(--muted)]">/{totals.all}</span></strong>
              <span className="caption text-[var(--muted)]">séries</span>
            </div>
          </div>
          <div className="progress-track -mx-4 !h-[3px] !rounded-none" role="progressbar" aria-label="Séries concluídas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <div className="progress-fill !rounded-none" style={{ width: `${progress}%` }} />
          </div>
        </header>

        <ReadinessLoadNote sessionId={active.sessionId} />
        <div className="mt-5 grid gap-3 xl:grid-cols-2">
          {active.exercises.map((exercise) => (
            <ExerciseCard
              key={exercise.exerciseId}
              exercise={exercise}
              collapsed={Boolean(collapsed[exercise.exerciseId])}
              optionsOpen={optionsFor === exercise.exerciseId}
              barWeight={barWeight}
              onToggleCollapsed={toggleCollapsed}
              onToggleOptions={toggleOptions}
              onReplace={openReplace}
              onPlates={openPlates}
              onRecordVideo={openVideo}
              onPlayVideo={playVideo}
            />
          ))}
        </div>

        <div
          className="glass-control fixed left-1/2 z-30 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-full p-1.5 pl-5"
          style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className="min-w-0 flex-1">
            <strong className="numeric block text-[17px] font-semibold leading-5">{progress}%<span className="ml-1 text-[13px] font-normal text-[var(--muted)]">concluído</span></strong>
            <span className="footnote numeric text-[var(--muted)]">{formatVolume(totals.volume)} levantados</span>
          </div>
          <Button onClick={finishRequest} disabled={finishing}>{finishing ? 'Salvando...' : 'Finalizar'}</Button>
        </div>
        <RestTimerOverlay />

        {record && (
          <div role="status" aria-live="polite" className="pointer-events-none fixed left-0 right-0 z-50 flex justify-center px-4" style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}>
            <div key={record.id} className="record-pop pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-[22px] bg-[#1d1d1f] px-4 py-3.5 text-[#f5f5f7] shadow-[var(--shadow-float)]">
              <span aria-hidden className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-gradient-to-b from-[#ffd60a] to-[#ff9f0a] text-[#1d1d1f]"><Trophy size={20} strokeWidth={2.2} /></span>
              <span className="min-w-0">
                <span className="caption block font-semibold uppercase tracking-wide text-[#ff9f45]">Novo recorde</span>
                <span className="headline block truncate">{record.exercise}</span>
                <span className="footnote block text-[#a1a1a6]">{record.detail}</span>
              </span>
            </div>
          </div>
        )}
        {notice && (
          <p role="status" className="toast-enter fixed left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-full bg-[#1d1d1f] px-5 py-3 text-center text-[15px] text-[#f5f5f7]" style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}>
            {notice}
          </p>
        )}

        <input ref={videoInput} type="file" accept="video/*" capture="environment" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void onVideoPicked(file) }} />

        <Modal open={discardOpen} onClose={() => setDiscardOpen(false)} title="Descartar treino">
          <p className="subhead mb-6 text-[var(--muted)]">Todo o progresso desta sessão será perdido.</p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setDiscardOpen(false)}>Continuar</Button>
            <Button variant="danger" className="flex-1" onClick={() => { discardSession(); router.replace('/workouts') }}>Descartar</Button>
          </div>
        </Modal>
        <Modal open={finishOpen} onClose={() => setFinishOpen(false)} title="Finalizar treino incompleto">
          <p className="subhead mb-6 text-[var(--muted)]">Há {totals.all - totals.done} séries pendentes. Só as concluídas entrarão no histórico.</p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setFinishOpen(false)}>Continuar</Button>
            <Button className="flex-1" disabled={finishing} onClick={() => void finish()}>Finalizar assim</Button>
          </div>
        </Modal>
        <PlateCalculator target={platesFor} defaultBar={barWeight} onClose={() => setPlatesFor(null)} />
        <ReplaceModal
          current={replacing ?? null}
          exercises={exercises}
          activeIds={new Set(active.exercises.map((item) => item.exerciseId))}
          onClose={() => setReplaceFor(null)}
          onPick={(item) => {
            if (replaceFor) replaceExercise(replaceFor, item, lastSetsForExercise(item.id, sessions))
            setReplaceFor(null)
          }}
        />
        <VideoModal mediaId={playing?.id ?? null} title={playing?.title ?? 'Vídeo'} onClose={() => setPlaying(null)} />
      </div>
    </BestsContext.Provider>
  )
}

/** Pushes "what now / what next" to the Android ongoing notification (lock screen). */
function useLiveStatus(active: ActiveSession | null) {
  const status = useMemo(() => {
    if (!active) return null
    const steps = active.exercises.flatMap((exercise) =>
      exercise.sets.map((set, index) => ({ exercise, set, index }))
    )
    const pendingIndex = steps.findIndex((step) => !step.set.completed)
    const describe = (step: (typeof steps)[number] | undefined) => step
      ? `${step.exercise.exerciseName} · série ${step.index + 1} de ${step.exercise.sets.length} · ${formatDecimal(step.set.weight)} kg × ${step.set.reps}`
      : 'Último passo: finalizar o treino'
    return {
      workoutName: active.workoutName,
      current: pendingIndex < 0 ? 'Tudo feito. Finalize o treino.' : describe(steps[pendingIndex]),
      next: pendingIndex < 0 ? 'Finalizar o treino' : describe(steps[pendingIndex]),
      doneSets: steps.filter((step) => step.set.completed).length,
      totalSets: steps.length,
    }
  }, [active])
  const key = status ? JSON.stringify(status) : ''

  useEffect(() => {
    if (!key) return
    const timer = setTimeout(() => {
      import('@/lib/timerPlugin').then(({ TimerPlugin }) => TimerPlugin.updateStatus(JSON.parse(key))).catch(() => undefined)
    }, 400)
    return () => clearTimeout(timer)
  }, [key])
}

/** Re-renders once per second on its own, so the rest of the workout screen doesn't. */
function WorkoutClock() {
  const workoutSeconds = useTimerStore((state) => state.workoutSeconds)
  const workoutRunning = useTimerStore((state) => state.workoutRunning)
  const tickWorkout = useTimerStore((state) => state.tickWorkout)

  useEffect(() => {
    if (!workoutRunning) return
    const timer = setInterval(tickWorkout, 1000)
    const onVisible = () => { if (document.visibilityState === 'visible') tickWorkout() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [tickWorkout, workoutRunning])

  return <span className="tabular-nums" aria-label={`Tempo de treino ${formatDuration(workoutSeconds)}`}>{formatDuration(workoutSeconds)}</span>
}

interface ExerciseCardProps {
  exercise: ActiveExercise
  collapsed: boolean
  optionsOpen: boolean
  barWeight: number
  onToggleCollapsed: (exerciseId: string) => void
  onToggleOptions: (exerciseId: string) => void
  onReplace: (exerciseId: string) => void
  onPlates: (name: string, weight: number) => void
  onRecordVideo: (exerciseId: string, setId: string) => void
  onPlayVideo: (mediaId: string, title: string) => void
}

const OPTION_BUTTON = 'flex min-h-12 items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--fill)] px-3.5 text-left text-[15px] font-medium'

// Store updates are immutable per exercise, so only the edited card re-renders.
const ExerciseCard = memo(function ExerciseCard({
  exercise, collapsed, optionsOpen, barWeight, onToggleCollapsed, onToggleOptions, onReplace, onPlates, onRecordVideo, onPlayVideo,
}: ExerciseCardProps) {
  const { addSet, removeSet, duplicateSet, applySetToFollowing, updateExerciseNotes, setRestSeconds, insertWarmupSets } = useSessionStore(
    useShallow((state) => ({
      addSet: state.addSet, removeSet: state.removeSet, duplicateSet: state.duplicateSet,
      applySetToFollowing: state.applySetToFollowing, updateExerciseNotes: state.updateExerciseNotes,
      setRestSeconds: state.setRestSeconds, insertWarmupSets: state.insertWarmupSets,
    }))
  )
  const baseSuggestion = useMemo(
    () => getProgressionSuggestion(exercise.previousSets ?? [], exercise.targetMaxReps ?? 12, exercise.progression),
    [exercise.previousSets, exercise.targetMaxReps, exercise.progression]
  )
  const suggestion = useReadinessSuggestion(baseSuggestion)
  const panelId = `exercise-${exercise.exerciseId}-sets`
  const optionsId = `exercise-${exercise.exerciseId}-options`
  const doneCount = exercise.sets.filter((set) => set.completed).length
  const workSet = exercise.sets.find((set) => (set.setType ?? 'normal') !== 'warmup')
  const workWeight = workSet?.weight ?? 0
  const warmupPreview = generateWarmupSets(workWeight, barWeight)
  const videoTarget = [...exercise.sets].reverse().find((set) => set.completed) ?? exercise.sets.find((set) => !set.completed) ?? exercise.sets[0]
  const videos = exercise.sets.map((set, index) => ({ set, index })).filter((item) => item.set.videoId)
  const allDone = doneCount === exercise.sets.length && exercise.sets.length > 0

  return (
    <section className={cn('tile !p-0', exercise.supersetId && 'shadow-[inset_3px_0_0_var(--accent-fill)]')} aria-label={exercise.exerciseName}>
      <div className="flex items-center gap-1 py-3 pl-5 pr-2">
        <button
          type="button"
          onClick={() => onToggleCollapsed(exercise.exerciseId)}
          aria-expanded={!collapsed}
          aria-controls={panelId}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="footnote block truncate font-semibold text-[var(--muted)]">
              {exercise.muscleGroup}{exercise.supersetId ? ' · Supersérie' : ''}
            </span>
            <span className="title-3 block truncate">{exercise.exerciseName}</span>
          </span>
          <span className={cn('caption numeric flex-none rounded-full px-2.5 py-1 font-semibold', allDone ? 'bg-[var(--success-fill)] text-white' : 'bg-[var(--fill)] text-[var(--muted)]')}>
            {doneCount}/{exercise.sets.length}
          </span>
          <ChevronDown size={18} aria-hidden className={cn('flex-none text-[var(--muted)] transition-transform duration-300', !collapsed && 'rotate-180')} />
        </button>
        <button
          type="button"
          onClick={() => onToggleOptions(exercise.exerciseId)}
          aria-expanded={optionsOpen}
          aria-controls={optionsId}
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-[var(--accent)]"
          aria-label={`Opções de ${exercise.exerciseName}`}
        >
          <MoreHorizontal size={20} aria-hidden />
        </button>
      </div>

      {optionsOpen && (
        <div id={optionsId} className="grid grid-cols-2 gap-2 border-t border-[var(--separator)] p-4">
          <button
            type="button"
            disabled={warmupPreview.length === 0}
            onClick={() => { insertWarmupSets(exercise.exerciseId, warmupPreview); onToggleOptions(exercise.exerciseId) }}
            className={cn(OPTION_BUTTON, 'disabled:opacity-40')}
            aria-label={warmupPreview.length ? `Gerar aquecimento: ${warmupPreview.map((step) => `${formatDecimal(step.weight)} kg por ${step.reps}`).join(', ')}` : 'Gerar aquecimento (defina a carga primeiro)'}
          >
            <Flame size={16} aria-hidden />Aquecimento
          </button>
          <button type="button" onClick={() => onPlates(exercise.exerciseName, workWeight)} className={OPTION_BUTTON}>
            <Scale size={16} aria-hidden />Anilhas
          </button>
          <button type="button" onClick={() => onReplace(exercise.exerciseId)} className={OPTION_BUTTON}>
            <Replace size={16} aria-hidden />Trocar
          </button>
          <button type="button" disabled={!videoTarget} onClick={() => videoTarget && onRecordVideo(exercise.exerciseId, videoTarget.id)} className={OPTION_BUTTON}>
            <Video size={16} aria-hidden />Gravar vídeo
          </button>
          {warmupPreview.length > 0 && (
            <p className="footnote col-span-2 px-1 text-[var(--muted)]">
              Aquecimento sugerido: {warmupPreview.map((step) => `${formatDecimal(step.weight)} kg × ${step.reps}`).join(' → ')}
            </p>
          )}
          <label className="col-span-2 mt-2 block">
            <span className="footnote mb-1.5 flex items-center gap-1.5 font-semibold text-[var(--muted)]"><NotebookPen size={14} aria-hidden />Notas e ajustes</span>
            <textarea
              value={exercise.notes ?? ''}
              onChange={(event) => updateExerciseNotes(exercise.exerciseId, event.target.value)}
              rows={2}
              className="field resize-none py-3"
              placeholder="Altura do banco, posição, dica técnica..."
            />
          </label>
          <div className="col-span-2 mt-1">
            <div className="footnote mb-2 flex items-center gap-1.5 font-semibold text-[var(--muted)]"><Timer size={14} aria-hidden />Descanso</div>
            <RestPresetPicker currentSeconds={exercise.restSeconds} onSelect={(seconds) => setRestSeconds(exercise.exerciseId, seconds)} />
          </div>
        </div>
      )}

      {!collapsed && (
        <div id={panelId} className="border-t border-[var(--separator)] px-3 pb-4 pt-3 sm:px-4">
          {suggestion && (
            <p className={cn('footnote mb-3 rounded-[var(--radius-sm)] px-3.5 py-2.5', suggestion.progressed ? 'bg-[color-mix(in_srgb,var(--success-fill)_12%,transparent)] text-[var(--success)]' : 'bg-[var(--fill)] text-[var(--muted-strong)]')}>
              <strong className="font-semibold">{formatDecimal(suggestion.weight)} kg sugeridos.</strong> {suggestion.reason}
            </p>
          )}
          <div className={cn(SET_GRID, 'caption mb-1 px-1 text-center font-semibold text-[var(--muted)]')} aria-hidden>
            <span>Tipo</span><span>Antes</span><span>Kg</span><span>Reps</span><span>RIR</span><span />
          </div>
          <div className="space-y-1">
            {exercise.sets.map((set, index) => (
              <SetRow
                key={set.id}
                exerciseId={exercise.exerciseId}
                exerciseName={exercise.exerciseName}
                restSeconds={exercise.restSeconds}
                set={set}
                index={index}
                previous={exercise.previousSets?.[index]}
              />
            ))}
          </div>
          {videos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 px-1">
              {videos.map(({ set, index }) => (
                <button key={set.id} type="button" onClick={() => onPlayVideo(set.videoId!, `${exercise.exerciseName} · série ${index + 1}`)} className="chip">
                  <Play size={13} fill="currentColor" aria-hidden />Vídeo série {index + 1}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 grid grid-cols-[1fr_1fr_1fr_3rem] gap-1.5">
            <button
              type="button"
              onClick={() => { const last = exercise.sets.at(-1); addSet(exercise.exerciseId, { weight: last?.weight ?? 0, reps: last?.reps ?? exercise.targetMinReps ?? 8, rpe: null, rir: last?.rir ?? 2, setType: 'normal' }) }}
              className="flex h-11 items-center justify-center gap-1 rounded-full bg-[var(--fill)] text-[13px] font-medium text-[var(--accent)]"
            >
              <Plus size={14} aria-hidden />Série
            </button>
            <button
              type="button"
              onClick={() => { const last = exercise.sets.at(-1); if (last) duplicateSet(exercise.exerciseId, last.id) }}
              className="flex h-11 items-center justify-center gap-1 rounded-full bg-[var(--fill)] text-[13px] font-medium text-[var(--accent)]"
            >
              <Copy size={14} aria-hidden />Duplicar
            </button>
            <button
              type="button"
              onClick={() => { const first = exercise.sets.find((set) => (set.setType ?? 'normal') !== 'warmup') ?? exercise.sets[0]; if (first) applySetToFollowing(exercise.exerciseId, first.id) }}
              className="flex h-11 items-center justify-center gap-1 rounded-full bg-[var(--fill)] text-[13px] font-medium text-[var(--accent)]"
              aria-label="Aplicar a primeira série de trabalho às seguintes"
            >
              <Layers3 size={14} aria-hidden />Aplicar
            </button>
            <button
              type="button"
              onClick={() => { const last = exercise.sets.at(-1); if (last) removeSet(exercise.exerciseId, last.id) }}
              disabled={exercise.sets.length === 1}
              className="flex h-11 items-center justify-center rounded-full bg-[var(--danger-soft)] text-[var(--danger)] disabled:opacity-30"
              aria-label="Remover última série"
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </div>
        </div>
      )}
    </section>
  )
})

interface SetRowProps {
  exerciseId: string
  exerciseName: string
  restSeconds: number
  set: ActiveSet
  index: number
  previous?: { weight: number; reps: number }
}

const SetRow = memo(function SetRow({ exerciseId, exerciseName, restSeconds, set, index, previous }: SetRowProps) {
  const updateSet = useSessionStore((state) => state.updateSet)
  const completeSet = useSessionStore((state) => state.completeSet)
  const startRest = useTimerStore((state) => state.startRest)
  const stopRest = useTimerStore((state) => state.stopRest)
  const best = useContext(BestsContext).get(exerciseId)
  const number = index + 1
  const setType = SET_TYPES.find((item) => item.value === (set.setType ?? 'normal'))
  const typeLabel = setType?.label ?? 'Trabalho'
  const shortLabel = setType?.shortLabel ?? 'N'
  const isWarmup = (set.setType ?? 'normal') === 'warmup'
  const isRecord = set.completed && !isWarmup && recordForSet(best, set.weight, set.reps) != null

  function toggleDone() {
    const completing = !set.completed
    completeSet(exerciseId, set.id)
    if (completing) {
      startRest(restSeconds)
      const kind = isWarmup ? null : recordForSet(best, set.weight, set.reps)
      if (kind) {
        window.dispatchEvent(new CustomEvent(RECORD_EVENT, {
          detail: {
            exercise: exerciseName,
            detail: kind === 'weight'
              ? `${formatDecimal(set.weight)} kg × ${set.reps} · maior carga (antes ${formatDecimal(best!.weight)} kg)`
              : `1RM estimado ${formatDecimal(Math.round(estimateOneRm(set.weight, set.reps) * 10) / 10)} kg (antes ${formatDecimal(Math.round(best!.oneRm * 10) / 10)} kg)`,
          },
        }))
      }
    } else if (useTimerStore.getState().restRunning) stopRest()
  }

  return (
    <div data-completed={set.completed} className={cn(SET_GRID, 'set-table-row p-1')}>
      <span className="relative flex h-11 items-center justify-center rounded-[10px] text-[14px] font-semibold text-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent)]">
        <span aria-hidden>{shortLabel}</span>
        <select
          value={set.setType ?? 'normal'}
          onChange={(event) => updateSet(exerciseId, set.id, { setType: event.target.value as typeof set.setType })}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
          aria-label={`Tipo da série ${number}: ${typeLabel}`}
        >
          {SET_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </span>
      <span className="text-center text-[12px] leading-tight text-[var(--muted)]" aria-label={previous ? `Anterior ${previous.weight} kg por ${previous.reps}` : 'Sem registro anterior'}>
        {isRecord
          ? <Trophy size={16} className="mx-auto text-[#ff9f0a]" aria-label="Recorde pessoal" />
          : previous ? `${formatDecimal(previous.weight)}×${previous.reps}` : '—'}
      </span>
      <DecimalInput value={set.weight} onValueChange={(value) => updateSet(exerciseId, set.id, { weight: value })} aria-label={`Carga, série ${number}`} className="set-field" />
      <DecimalInput integer value={set.reps} onValueChange={(value) => updateSet(exerciseId, set.id, { reps: value })} aria-label={`Repetições, série ${number}`} className="set-field" />
      <DecimalInput integer max={10} value={set.rir ?? 2} onValueChange={(value) => updateSet(exerciseId, set.id, { rir: value })} aria-label={`RIR, série ${number}`} className="set-field" />
      <button
        type="button"
        onClick={toggleDone}
        aria-pressed={set.completed}
        className={cn(
          'mx-auto flex h-11 w-11 items-center justify-center rounded-full transition-[background-color,transform] duration-200 active:scale-90',
          set.completed ? 'bg-[var(--success-fill)] text-[var(--on-success)]' : 'text-[var(--muted)] shadow-[inset_0_0_0_1.5px_var(--separator)]'
        )}
        aria-label={set.completed ? `Desmarcar série ${number}` : `Concluir série ${number}`}
      >
        <Check size={20} strokeWidth={set.completed ? 3 : 2.2} aria-hidden />
      </button>
    </div>
  )
})

function ReplaceModal({ current, exercises, activeIds, onClose, onPick }: {
  current: ActiveExercise | null
  exercises: Exercise[]
  activeIds: Set<string>
  onClose: () => void
  onPick: (exercise: Exercise) => void
}) {
  const source = exercises.find((item) => item.id === current?.exerciseId)
  const candidates = exercises.filter((item) => item.id !== current?.exerciseId && !activeIds.has(item.id))
  const alternativeNames = new Set((source?.alternatives ?? []).map((name) => name.toLowerCase()))
  const alternatives = candidates.filter((item) => alternativeNames.has(item.name.toLowerCase()))
  const sameMuscle = candidates.filter((item) => !alternatives.includes(item) && item.muscleGroup === current?.muscleGroup)
  const others = candidates.filter((item) => !alternatives.includes(item) && !sameMuscle.includes(item))
  const groups: Array<[string, Exercise[]]> = [
    ['Alternativas cadastradas', alternatives],
    [`Mesmo grupo · ${current?.muscleGroup ?? ''}`, sameMuscle],
    ['Outros exercícios', others],
  ]

  return (
    <Modal open={!!current} onClose={onClose} title="Trocar exercício">
      <p className="subhead mb-4 text-[var(--muted)]">Máquina ocupada? Escolha outro exercício. As cargas da última vez que você fez o substituto são preenchidas.</p>
      <div className="max-h-[55vh] space-y-5 overflow-y-auto">
        {groups.filter(([, items]) => items.length > 0).map(([label, items]) => (
          <div key={label}>
            <p className="list-header">{label}</p>
            <div className="list !bg-[var(--fill)]">
              {items.map((item) => (
                <button key={item.id} type="button" onClick={() => onPick(item)} className="grouped-row block min-h-14 w-full px-4 py-3 text-left">
                  <span className="block text-[17px]">{item.name}</span>
                  <span className="footnote text-[var(--muted)]">{item.muscleGroup}{item.equipment ? ` · ${item.equipment}` : ''}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

function Summary({ summary, onClose }: { summary: SummaryData; onClose: () => void }) {
  const healthSync = useProfileStore((state) => state.profile?.preferences?.healthSync ?? false)
  const [heartRate, setHeartRate] = useState<number | null>(null)
  const [sharing, setSharing] = useState(false)
  const [shareNote, setShareNote] = useState<string | null>(null)

  useEffect(() => {
    if (!healthSync) return
    void averageHeartRate(summary.startedAt, summary.finishedAt).then(setHeartRate)
  }, [healthSync, summary.finishedAt, summary.startedAt])

  const stats: Array<[string, string]> = [
    [formatVolume(summary.volume), 'Volume'],
    [formatDuration(summary.duration), 'Tempo'],
    [`${summary.sets}`, 'Séries'],
    heartRate ? [`${heartRate} bpm`, 'FC média'] : [`+${summary.xp}`, 'XP'],
  ]

  async function share() {
    setSharing(true)
    setShareNote(null)
    try {
      const blob = await renderShareCard({
        eyebrow: format(summary.finishedAt, "EEEE, d 'de' MMMM", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase()),
        title: summary.workoutName,
        subtitle: 'Treino concluído',
        stats: stats.map(([value, label]) => ({ label, value })),
        highlight: summary.prs > 0 ? `${summary.prs} recorde${summary.prs > 1 ? 's' : ''} pessoal${summary.prs > 1 ? 'is' : ''}` : undefined,
      })
      const result = await shareImage(blob, `workoutpro-${format(summary.finishedAt, 'yyyy-MM-dd')}.png`, `${summary.workoutName} concluído no WorkoutPro`)
      if (result === 'downloaded') setShareNote('Imagem salva. Poste nos Stories quando quiser.')
    } catch {
      setShareNote('Não foi possível gerar a imagem.')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="apple-page page-narrow flex min-h-dvh items-center !pb-10">
      <div className="rise-in w-full text-center">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-b from-[#ffd60a] to-[#ff9f0a] text-[#1d1d1f]" aria-hidden><Trophy size={36} strokeWidth={2} /></span>
        <p className="eyebrow mt-8">{summary.workoutName}</p>
        <h1 className="display mt-1">Treino concluído</h1>
        <p className="lede mx-auto mt-3 max-w-xs">
          {summary.prs > 0
            ? `Você bateu ${summary.prs} recorde${summary.prs > 1 ? 's' : ''} pessoal${summary.prs > 1 ? 'is' : ''} hoje.`
            : 'Consistência registrada. Bom trabalho.'}
        </p>
        <dl className="mt-10 grid grid-cols-2 gap-3 text-left">
          {stats.map(([value, label]) => (
            <div key={label} className="tile tile-compact flex flex-col-reverse">
              <dt className="subhead text-[var(--muted)]">{label}</dt>
              <dd className="stat text-[28px]">{value}</dd>
            </div>
          ))}
        </dl>
        <Button size="lg" className="mt-10 w-full" onClick={onClose}>Voltar ao início</Button>
        <Button size="lg" variant="secondary" className="mt-3 w-full" onClick={share} disabled={sharing}>
          <Share size={17} aria-hidden />{sharing ? 'Gerando imagem...' : 'Compartilhar'}
        </Button>
        {shareNote && <p role="status" className="footnote mt-3 text-[var(--muted)]">{shareNote}</p>}
        <Link href="/stats" className={buttonClasses({ variant: 'ghost', className: 'mt-2 w-full' })}>Ver progresso</Link>
      </div>
    </div>
  )
}
