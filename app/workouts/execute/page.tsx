'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Check, Plus, Timer, ChevronDown, ChevronUp,
  Trophy, Zap, Clock, Minus, Share2
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
    <div className="flex items-center justify-center gap-0.5">
      <button
        onClick={() => onChange(Math.max(min, value - step))}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 active:scale-90 transition-all"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <Minus size={11} />
      </button>
      <div className="text-center min-w-[38px]">
        <span className="text-sm font-bold text-white tabular-nums">{value}</span>
        {suffix && <span className="text-[10px] text-zinc-500 ml-0.5">{suffix}</span>}
      </div>
      <button
        onClick={() => onChange(value + step)}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 active:scale-90 transition-all"
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
  const { workoutSeconds, workoutRunning, startWorkoutTimer, stopWorkoutTimer, resetWorkoutTimer, startRest, tickWorkout } = useTimerStore()
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
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-6 max-w-sm w-full"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', damping: 10 }}
            className="w-24 h-24 rounded-3xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto"
          >
            <Trophy size={40} className="text-indigo-400" />
          </motion.div>

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
          <AnimatePresence>
            {shareToast && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="fixed bottom-8 left-1/2 -translate-x-1/2 rounded-xl px-4 py-2 text-sm font-medium text-white"
                style={{ background: 'rgba(30,30,35,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Copiado para a área de transferência!
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen page-content">
      {/* Header */}
      <div
        className="sticky top-0 z-30 px-4 pt-12 pb-4 border-b border-white/5"
        style={{ background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(16px)' }}
      >
        <div className="flex items-center gap-3 mb-3 max-w-lg mx-auto">
          <div className="w-3 h-3 rounded-full flex-none" style={{ background: active.workoutColor }} />
          <h1 className="flex-1 font-bold text-white">{active.workoutName}</h1>
          <div className="flex items-center gap-1 text-sm text-zinc-400">
            <Clock size={14} />
            <span className="font-mono font-semibold">{formatDuration(workoutSeconds)}</span>
          </div>
          <button
            onClick={() => setConfirmDiscard(true)}
            className="rounded-lg p-1.5 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="max-w-lg mx-auto">
          <div className="flex justify-between text-xs text-zinc-600 mb-1">
            <span>{totalCompleted} / {totalSets} séries</span>
            <span>{Math.round((totalCompleted / Math.max(totalSets, 1)) * 100)}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: active.workoutColor }}
              animate={{ width: `${(totalCompleted / Math.max(totalSets, 1)) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      </div>

      {/* Exercises */}
      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto pb-32">
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
                </div>
                {completedSets === ex.sets.length && ex.sets.length > 0 && (
                  <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                    <Check size={12} /> Feito
                  </span>
                )}
                {isCollapsed ? <ChevronDown size={16} className="text-zinc-600" /> : <ChevronUp size={16} className="text-zinc-600" />}
              </button>

              {!isCollapsed && (
                <div className="px-4 pb-4 space-y-2">
                  {/* Column headers */}
                  <div className="grid grid-cols-[22px_1fr_1fr_36px] gap-2 text-[10px] text-zinc-600 px-1 mb-1">
                    <span className="text-center">#</span>
                    <span className="text-center font-medium">PESO (kg)</span>
                    <span className="text-center font-medium">REPS</span>
                    <span />
                  </div>

                  <AnimatePresence mode="popLayout">
                    {ex.sets.map((set, idx) => (
                      <motion.div
                        key={set.id}
                        layout
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 12 }}
                        className="grid grid-cols-[22px_1fr_1fr_36px] gap-2 items-center rounded-xl px-2 py-2.5 transition-all"
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
                          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 flex-none"
                          style={set.completed
                            ? { background: '#00c896', color: '#080809' }
                            : { background: 'rgba(255,255,255,0.06)', color: '#71717a' }
                          }
                        >
                          <Check size={15} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>

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
                    className="w-full py-2 rounded-xl border border-dashed border-white/10 text-xs text-zinc-500 hover:text-white hover:border-white/20 transition-all flex items-center justify-center gap-1"
                  >
                    <Plus size={12} />
                    Adicionar Série
                  </button>

                  {/* Rest timer */}
                  <div className="mt-3 pt-3 border-t border-white/5">
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
      <div className="fixed bottom-20 left-0 right-0 flex justify-center px-4 pointer-events-none z-20">
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
