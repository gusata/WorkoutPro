'use client'

import { useEffect } from 'react'
import { SkipForward } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useTimerStore } from '@/stores/useTimerStore'
import { CircularProgress } from '@/components/ui/Progress'
import { formatDuration, REST_PRESETS } from '@/lib/utils'
import { cn } from '@/lib/cn'

export function RestTimerOverlay() {
  const { restSeconds, restTotal, restRunning } = useTimerStore(
    useShallow((state) => ({ restSeconds: state.restSeconds, restTotal: state.restTotal, restRunning: state.restRunning }))
  )
  const stopRest = useTimerStore((state) => state.stopRest)
  const extendRest = useTimerStore((state) => state.extendRest)
  const tickRest = useTimerStore((state) => state.tickRest)

  useEffect(() => {
    if (!restRunning) return
    // 500ms keeps the countdown from visibly skipping a second when the interval drifts.
    const interval = setInterval(tickRest, 500)
    const onVisible = () => { if (document.visibilityState === 'visible') tickRest() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [restRunning, tickRest])

  if (!restRunning) return null

  return (
    <div
      className="fixed left-0 right-0 z-40 flex justify-center px-3"
      style={{ bottom: 'calc(max(0.75rem, env(safe-area-inset-bottom)) + 5.5rem)' }}
    >
      <section aria-label="Descanso" data-testid="rest-timer" className="toast-enter flex w-full max-w-md items-center gap-3 rounded-[30px] bg-[#1d1d1f] p-2.5 pl-3 text-[#f5f5f7] shadow-[var(--shadow-float)]">
        <CircularProgress value={restTotal - restSeconds} max={restTotal} size={50} strokeWidth={5} color="#2997ff">
          <span className="numeric text-[13px] font-semibold text-[#f5f5f7]" aria-hidden>{restSeconds}</span>
        </CircularProgress>

        <div className="min-w-0 flex-1">
          <p className="caption font-semibold text-[#a1a1a6]">Descanso</p>
          <p className="stat whitespace-nowrap text-[24px] leading-7 text-[#f5f5f7]" role="timer" aria-live="off" aria-label={`Descanso restante ${formatDuration(restSeconds)}`} data-testid="rest-remaining">{Math.floor(restSeconds / 60)}:{String(restSeconds % 60).padStart(2, '0')}</p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => extendRest(15)}
            data-testid="rest-extend"
            className="numeric flex h-11 min-w-12 items-center justify-center rounded-full bg-white/12 px-3.5 text-[15px] font-medium text-[#f5f5f7] transition-transform active:scale-95"
            aria-label="Adicionar 15 segundos"
          >
            +15s
          </button>
          <button
            type="button"
            onClick={stopRest}
            data-testid="rest-skip"
            className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-[var(--accent-fill)] px-4 text-[15px] font-medium text-[var(--on-accent)] transition-transform active:scale-95"
          >
            <SkipForward size={16} aria-hidden />
            Pular
          </button>
        </div>
      </section>
    </div>
  )
}

interface RestPresetPickerProps {
  currentSeconds: number
  onSelect: (seconds: number) => void
}

export function RestPresetPicker({ currentSeconds, onSelect }: RestPresetPickerProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Tempo de descanso">
      {REST_PRESETS.map((seconds) => {
        const selected = currentSeconds === seconds
        return (
          <button
            key={seconds}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(seconds)}
            className={cn(
              'numeric h-11 min-w-14 rounded-full px-3.5 text-[15px] font-medium transition-colors',
              selected ? 'bg-[var(--foreground)] text-[var(--background-elevated)]' : 'bg-[var(--fill)] text-[var(--foreground)]'
            )}
          >
            {seconds}s
          </button>
        )
      })}
    </div>
  )
}
