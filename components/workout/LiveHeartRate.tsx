'use client'

import { useEffect, useRef, useState } from 'react'
import { Heart } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { maxHeartRate } from '@/lib/cardio'
import { formatSampleAge, freshSample, isRecovered, recoveryThreshold } from '@/lib/liveHeart'
import { useHealthStore } from '@/stores/useHealthStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { useTimerStore } from '@/stores/useTimerStore'

/** Re-renders every few seconds so the "há 20 s" age and freshness stay honest. */
function useNow(intervalMs = 5000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

function useLatestHeart() {
  const healthSync = useProfileStore((state) => state.profile?.preferences?.healthSync ?? false)
  const latest = useHealthStore((state) => state.heartToday?.latest ?? null)
  return healthSync ? latest : null
}

/** The heart rate under which a rest counts as recovered (settings, else resting / max HR). */
export function useRecoveryThreshold() {
  const preferences = useProfileStore((state) => state.profile?.preferences)
  const restingHr = useHealthStore((state) => state.restingHr.at(-1)?.value ?? null)
  return recoveryThreshold({ custom: preferences?.recoveryHeartRate, maxHr: maxHeartRate(preferences), restingHr })
}

/** Compact "♥ 128 · há 20 s" for the workout header. Hidden without a recent reading. */
export function LiveHeartRate() {
  const latest = useLatestHeart()
  const now = useNow()
  const sample = freshSample(latest, now)
  if (!sample) return null
  const time = new Date(sample.time)
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Frequência cardíaca ${sample.bpm} bpm, ${formatSampleAge(time, now)}`}>
      <Heart size={12} fill="#ff375f" stroke="#ff375f" aria-hidden />
      <span className="font-semibold text-[var(--foreground)]">{sample.bpm}</span>
      <span>bpm · {formatSampleAge(time, now)}</span>
    </span>
  )
}

/**
 * During rest: once the heart rate has dropped under the recovery threshold, says so
 * (with one light vibration). The rest timer keeps running; this is only a hint.
 */
export function RestHeartHint() {
  const latest = useLatestHeart()
  const threshold = useRecoveryThreshold()
  const { restRunning, restEndAt, restTotal } = useTimerStore(
    useShallow((state) => ({ restRunning: state.restRunning, restEndAt: state.restEndAt, restTotal: state.restTotal }))
  )
  const now = useNow(2000)
  const restStartedAt = restRunning && restEndAt != null ? restEndAt - restTotal * 1000 : null
  const recovered = restRunning && isRecovered(latest, restStartedAt, threshold, now)
  const notified = useRef<number | null>(null)

  useEffect(() => {
    if (!recovered || restStartedAt == null) return
    // Once per rest; "+15s" keeps the same start, so it does not vibrate again.
    const key = Math.round(restStartedAt / 5000)
    if (notified.current === key) return
    notified.current = key
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(40)
  }, [recovered, restStartedAt])

  if (!recovered || !latest) return null
  return (
    <div
      className="pointer-events-none fixed left-0 right-0 z-40 flex justify-center px-3"
      style={{ bottom: 'calc(max(0.75rem, env(safe-area-inset-bottom)) + 10.25rem)' }}
    >
      <p role="status" aria-live="polite" className="toast-enter flex items-center gap-2 rounded-full bg-[#1d1d1f] px-4 py-2 text-[15px] text-[#f5f5f7] shadow-[var(--shadow-float)]">
        <Heart size={14} fill="#30d158" stroke="#30d158" aria-hidden />
        <span>FC recuperada (<span className="numeric font-semibold">{latest.bpm} bpm</span>) — pode ir</span>
      </p>
    </div>
  )
}
