'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, Check, Plus, Timer, ChevronDown, ChevronUp,
  Trophy, Zap, Clock, Minus, Share2, Trash2
} from 'lucide-react'
import { useSessionStore } from '@/stores/useSessionStore'
import { useTimerStore } from '@/stores/useTimerStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { RestTimerOverlay, RestPresetPicker } from '@/components/timer/RestTimer'
import { formatDuration } from '@/lib/utils'

function NumberInput({ value, onChange, min = 0, step = 1, suffix }: {
  value: number, onChange: (v: number) => void, min?: number, step?: number, suffix?: string
}) {
  return (
    <div className="flex min-w-0 items-center justify-center gap-0.5">
      <button
        onClick={() => onChange(Math.max(min, value - step))}
        className="flex h-6 w-6 flex-none items-center justify-center rounded-lg text-zinc-400 transition-colors"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <Minus size={11} />
      </button>
      <div className="min-w-[30px] text-center">
        <span className="text-xs font-bold text-white tabular-nums">{value}</span>
        {suffix && <span className="text-[10px] text-zinc-500 ml-0.5">{suffix}</span>}
      </div>
      <button
        onClick={() => onChange(value + step)}
        className="flex h-6 w-6 flex-none items-center justify-center rounded-lg text-zinc-400 transition-colors"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <Plus size={11} />
      </button>
    </div>
  )
}

export default function ExecutePage() {
  const router = useRouter()
  const { active, updateSet, completeSet, addSet, removeSet, setRestSeconds, endSession, discardSession } = useSessionStore()
  const { workoutSeconds, workoutRunning, startWorkoutTimer, stopWorkoutTimer, resetWorkoutTimer, startRest, tickWorkout, tickRest } = useTimerStore()
  const { load: reloadProfile, checkAchievements } = useProfileStore()

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [summary, setSummary] = useState<{
    volume: number; xp: number; duration: number; workoutName: string
  } | null>(null)
  const [shareToast, setShareToast] = useState(false)
  const shareToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!active) { router.replace('/workouts'); return }
    if (!workoutRunning) startWorkoutTimer()
    // Dynamically import to avoid Turbopack module-level issues with @capacitor/core
    import('@/lib/notifications')
      .then(({ requestNotificationPermission }) => requestNotificationPermission())
      .catch(() => {})
  }, [active, workoutRunning, startWorkoutTimer, router])

  useEffect(() => {
    if (!workoutRunning) return
    const interval = setInterval(tickWorkout, 1000)
    return () => clearInterval(interval)
  }, [workoutRunning, tickWorkout])

  // Recalculate both timers from wall-clock the moment the app returns to foreground.
  // setInterval is throttled/paused by Android when backgrounded; this gives instant correction.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        tickWorkout()
        tickRest()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [tickWorkout, tickRest])

  const totalCompleted = active?.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.completed).length, 0
  ) ?? 0

  const totalSets = active?.exercises.reduce((acc, ex) => acc + ex.sets.length, 0) ?? 0

  async function handleFinish() {
    setFinishing(true)
    stopWorkoutTimer()
    const workoutName = active?.workoutName ?? ''
    const session = await endSession()
    if (session) {
      setSummary({ volume: session.totalVolume, xp: session.xpEarned, duration: session.duration, workoutName })
      await reloadProfile()
      await checkAchievements()
    }
    resetWorkoutTimer()
    setFinishing(false)
  }

  function handleCompleteSet(exerciseId: string, setId: string) {
    const exercise = active?.exercises.find((e) => e.exerciseId === exerciseId)
    const set = exercise?.sets.find((s) => s.id === setId)
    if (!set?.completed) {
      startRest(exercise?.restSeconds ?? 90)
    }
    completeSet(exerciseId, setId)
  }

  async function handleShare() {
    if (!summary) return
    const text = [
      `💪 Treino concluído: ${summary.workoutName}`,
      `⏱ Duração: ${formatDuration(summary.duration)}`,
      `🏋️ Volume: ${(summary.volume / 1000).toFixed(1)}t`,
      `⚡ +${summary.xp} XP`,
      '',
      'Treinado com WorkoutPro',
    ].join('\n')

    try {
      if (navigator.share) {
        await navigator.share({ title: 'WorkoutPro', text })
      } else {
        await navigator.clipboard.writeText(text)
        // show toast
        if (shareToastTimerRef.current) clearTimeout(shareToastTimerRef.current)
        setShareToast(true)
        shareToastTimerRef.current = setTimeout(() => setShareToast(false), 2500)
      }
    } catch {
      // user cancelled share or clipboard failed — do nothing
    }
  }

  if (!active) return null

  if (summary) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-sm w-full">
          <div className="w-24 h-24 rounded-3xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto">
            <Trophy size={40} className="text-indigo-400" />
          </div>

          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Treino Concluído!</h1>
            <p className="text-zinc-500">Incrível trabalho, atleta 💪</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4 text-center">
              <Clock size={16} className="text-indigo-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">{formatDuration(summary.duration)}</p>
              <p className="text-xs text-zinc-500">Duração</p>
            </Card>
            <Card className="p-4 text-center">
              <Zap size={16} className="text-yellow-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">+{summary.xp}</p>
              <p className="text-xs text-zinc-500">XP</p>
            </Card>
            <Card className="p-4 text-center">
              <Check size={16} className="text-emerald-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">{(summary.volume / 1000).toFixed(1)}t</p>
              <p className="text-xs text-zinc-500">Volume</p>
            </Card>
          </div>

          <div className="flex gap-3">
            <Button size="lg" variant="outline" className="flex-1" onClick={handleShare}>
              <Share2 size={16} />
              Compartilhar
            </Button>
            <Button size="lg" className="flex-1" onClick={() => router.replace('/dashboard')}>
              Ver Dashboard
            </Button>
          </div>

          {/* Clipboard toast */}
          <>
            {shareToast && (
              <div
                className="fixed bottom-8 left-1/2 -translate-x-1/2 rounded-xl px-4 py-2 text-sm font-medium text-white"
                style={{ background: 'rgba(30,30,35,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Copiado para a área de transferência!
              </div>
            )}
          </>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen page-content">
      {/* Floating workout controls */}
      <div className="sticky top-0 z-30 px-4 pb-4 pt-8 pointer-events-none">
        <div className="mx-auto mb-3 flex max-w-lg items-center gap-2">
          <div className="workout-bubble pointer-events-auto flex min-w-0 flex-1 items-center gap-3 rounded-full px-3.5 py-2.5">
            <div className="h-3 w-3 flex-none rounded-full" style={{ background: active.workoutColor }} />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-bold text-white">{active.workoutName}</h1>
              <p className="text-[11px] text-zinc-500">{totalCompleted} / {totalSets} series</p>
            </div>
          </div>
          <div className="workout-bubble pointer-events-auto flex flex-none items-center gap-1.5 rounded-full px-3.5 py-2.5 text-sm text-zinc-400">
            <Clock size={14} />
            <span className="font-mono font-semibold">{formatDuration(workoutSeconds)}</span>
          </div>
          <button
            onClick={() => setConfirmDiscard(true)}
            className="workout-bubble pointer-events-auto flex h-11 w-11 flex-none items-center justify-center rounded-full text-zinc-600 transition-colors hover:text-rose-400"
            aria-label="Cancelar treino"
          >
            <X size={16} />
          </button>
        </div>

        {/* Progress bubble */}
        <div className="workout-bubble pointer-events-auto mx-auto max-w-lg rounded-full px-3 py-2">
          <div className="flex justify-between text-[11px] text-zinc-600 mb-1">
            <span>{totalCompleted} / {totalSets} séries</span>
            <span>{Math.round((totalCompleted / Math.max(totalSets, 1)) * 100)}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ background: active.workoutColor, width: `${(totalCompleted / Math.max(totalSets, 1)) * 100}%`, transition: 'width 220ms ease-out' }}
            />
          </div>
        </div>
      </div>

      {/* Exercises */}
      <div className="mx-auto max-w-lg space-y-4 px-4 py-4 pb-64">
        {active.exercises.map((ex) => {
          const isCollapsed = collapsed[ex.exerciseId]
          const completedSets = ex.sets.filter((s) => s.completed).length

          return (
            <Card key={ex.exerciseId} className="overflow-hidden">
              {/* Exercise header */}
              <button
                className="w-full p-4 flex items-center gap-3 text-left"
                onClick={() => setCollapsed((c) => ({ ...c, [ex.exerciseId]: !c[ex.exerciseId] }))}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-none text-xs font-bold"
                  style={{ background: `${active.workoutColor}20`, color: active.workoutColor }}
                >
                  {completedSets}/{ex.sets.length}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm">{ex.exerciseName}</p>
                  <p className="text-xs text-zinc-500">{ex.muscleGroup}</p>
                  {ex.notes && <p className="mt-1 line-clamp-1 text-[11px] text-zinc-500">{ex.notes}</p>}
                </div>
                {completedSets === ex.sets.length && ex.sets.length > 0 && (
                  <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                    <Check size={12} /> Feito
                  </span>
                )}
                {isCollapsed ? <ChevronDown size={16} className="text-zinc-600" /> : <ChevronUp size={16} className="text-zinc-600" />}
              </button>

              {!isCollapsed && (
                <div className="space-y-2 px-3 pb-4 sm:px-4">
                  {/* Column headers */}
                  <div className="mb-1 grid grid-cols-[18px_minmax(68px,1fr)_minmax(68px,1fr)_32px_32px] gap-1 px-1 text-[9px] text-zinc-600">
                    <span className="text-center">#</span>
                    <span className="text-center font-medium">PESO</span>
                    <span className="text-center font-medium">REPS</span>
                    <span />
                    <span />
                  </div>

                  {ex.sets.map((set, idx) => (
                      <div
                        key={set.id}
                        className="grid grid-cols-[18px_minmax(68px,1fr)_minmax(68px,1fr)_32px_32px] gap-1 items-center rounded-xl px-1.5 py-2.5 transition-colors"
                        style={set.completed
                          ? { background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.18)' }
                          : { background: 'rgba(255,255,255,0.03)' }
                        }
                      >
                        <span className="text-[11px] text-zinc-600 text-center font-mono leading-none">{idx + 1}</span>

                        <NumberInput
                          value={set.weight}
                          step={2.5}
                          onChange={(v) => updateSet(ex.exerciseId, set.id, { weight: v })}
                        />

                        <NumberInput
                          value={set.reps}
                          onChange={(v) => updateSet(ex.exerciseId, set.id, { reps: v })}
                        />

                        <button
                          onClick={() => handleCompleteSet(ex.exerciseId, set.id)}
                          className="flex h-8 w-8 flex-none items-center justify-center rounded-xl transition-colors"
                          style={set.completed
                            ? { background: '#00c896', color: '#080809' }
                            : { background: 'rgba(255,255,255,0.06)', color: '#71717a' }
                          }
                        >
                          <Check size={15} />
                        </button>

                        <button
                          onClick={() => removeSet(ex.exerciseId, set.id)}
                          disabled={ex.sets.length <= 1}
                          className="flex h-8 w-8 flex-none items-center justify-center rounded-xl transition-colors disabled:pointer-events-none disabled:opacity-30"
                          style={{ background: 'rgba(244,63,94,0.1)', color: '#f43f5e' }}
                          aria-label="Remover serie"
                          title={ex.sets.length <= 1 ? 'Mantenha pelo menos uma serie' : 'Remover serie'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}

                  {/* Add set */}
                  <button
                    onClick={() => {
                      const last = ex.sets[ex.sets.length - 1]
                      addSet(ex.exerciseId, {
                        weight: last?.weight ?? 0,
                        reps: last?.reps ?? 0,
                        rpe: null,
                      })
                    }}
                    className="w-full py-2 rounded-xl border border-dashed border-white/10 text-xs text-zinc-500 hover:text-white hover:border-white/20 transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus size={12} />
                    Adicionar Série
                  </button>

                  {/* Rest timer */}
                  <div className="mt-3 pt-3 border-t border-white/5">
                    {ex.notes && (
                      <div className="mb-3 rounded-2xl bg-[var(--surface-2)] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Notas</p>
                        <p className="mt-1 text-xs text-white">{ex.notes}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-2">
                      <Timer size={12} className="text-zinc-600" />
                      <span className="text-xs text-zinc-500">Descanso</span>
                    </div>
                    <RestPresetPicker
                      currentSeconds={ex.restSeconds}
                      onSelect={(s) => setRestSeconds(ex.exerciseId, s)}
                    />
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Finish button */}
      <div className="fixed bottom-28 left-0 right-0 z-30 flex justify-center px-4 pointer-events-none">
        <Button
          size="lg"
          className="w-full max-w-sm pointer-events-auto shadow-2xl shadow-indigo-500/20"
          onClick={handleFinish}
          disabled={finishing}
        >
          {finishing ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Finalizando...
            </span>
          ) : (
            <>
              <Trophy size={18} />
              Finalizar Treino
            </>
          )}
        </Button>
      </div>

      {/* Rest timer overlay */}
      <RestTimerOverlay />

      {/* Discard modal */}
      <Modal open={confirmDiscard} onClose={() => setConfirmDiscard(false)} title="Descartar treino">
        <p className="text-sm text-zinc-400 mb-6">
          Tem certeza? Todo o progresso deste treino será perdido.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setConfirmDiscard(false)}>
            Continuar
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => {
              discardSession()
              resetWorkoutTimer()
              router.replace('/workouts')
            }}
          >
            <X size={16} />
            Descartar
          </Button>
        </div>
      </Modal>
    </div>
  )
}
