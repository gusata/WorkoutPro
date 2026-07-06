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
          className="fixed bottom-44 left-0 right-0 z-40 flex justify-center px-4"
        >
          <div className="glass-panel flex w-full max-w-sm items-center gap-4 rounded-[26px] px-5 py-4">
            <CircularProgress
              value={restTotal - restSeconds}
              max={restTotal}
              size={56}
              strokeWidth={4}
              color="var(--accent)"
            >
              <span className="text-xs font-bold text-[var(--foreground)]">{restSeconds}</span>
            </CircularProgress>

            <div className="flex-1">
              <p className="text-xs text-[var(--muted)] font-medium">DESCANSO</p>
              <p className="text-xl font-bold text-[var(--foreground)]">{formatDuration(restSeconds)}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => startRest(restTotal)}
                className="rounded-xl p-2 bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <SkipForward size={16} />
              </button>
              <button
                onClick={stopRest}
                className="rounded-xl p-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 transition-colors"
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
              ? 'bg-[var(--accent)] text-white'
              : 'bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground)]'
          }`}
        >
          {s}s
        </button>
      ))}
    </div>
  )
}
