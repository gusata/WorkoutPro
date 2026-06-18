'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, SkipForward } from 'lucide-react'
import { useTimerStore } from '@/stores/useTimerStore'
import { CircularProgress } from '@/components/ui/Progress'
import { formatDuration } from '@/lib/utils'
import { REST_PRESETS } from '@/lib/utils'

export function RestTimerOverlay() {
  const { restSeconds, restTotal, restRunning, stopRest, startRest, tickRest } = useTimerStore()

  useEffect(() => {
    if (!restRunning) return
    const interval = setInterval(tickRest, 1000)
    return () => clearInterval(interval)
  }, [restRunning, tickRest])

  return (
    <AnimatePresence>
      {restRunning && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-24 left-0 right-0 z-40 flex justify-center px-4"
        >
          <div className="flex items-center gap-4 rounded-2xl bg-zinc-900/95 border border-white/10 backdrop-blur-xl px-5 py-4 shadow-2xl w-full max-w-sm">
            <CircularProgress
              value={restTotal - restSeconds}
              max={restTotal}
              size={56}
              strokeWidth={4}
              color="#6366f1"
            >
              <span className="text-xs font-bold text-white">{restSeconds}</span>
            </CircularProgress>

            <div className="flex-1">
              <p className="text-xs text-zinc-400 font-medium">DESCANSO</p>
              <p className="text-xl font-bold text-white">{formatDuration(restSeconds)}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => startRest(restTotal)}
                className="rounded-xl p-2 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              >
                <SkipForward size={16} />
              </button>
              <button
                onClick={stopRest}
                className="rounded-xl p-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface RestPresetPickerProps {
  currentSeconds: number
  onSelect: (seconds: number) => void
}

export function RestPresetPicker({ currentSeconds, onSelect }: RestPresetPickerProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {REST_PRESETS.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
            currentSeconds === s
              ? 'bg-indigo-500 text-white'
              : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          {s}s
        </button>
      ))}
    </div>
  )
}
