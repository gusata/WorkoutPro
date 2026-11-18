'use client'

import { useEffect, useMemo, useState } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { X } from 'lucide-react'
import { useTodayReadiness } from '@/components/health/useReadiness'
import { applyReadinessToSuggestion, readinessLoadAdjustment, type AdjustedSuggestion, type LoadAdjustment } from '@/lib/readiness'
import type { ProgressionSuggestion } from '@/lib/training'

interface ReadinessNoteState {
  /** Readiness adjustment for the active session; null = none or dismissed. */
  adjustment: LoadAdjustment | null
  /** Session id for which the user dismissed the note. */
  dismissedFor: string | null
  setAdjustment: (adjustment: LoadAdjustment | null) => void
  dismiss: (sessionId: string) => void
}

const useReadinessNoteStore = create<ReadinessNoteState>()(
  persist(
    (set) => ({
      adjustment: null,
      dismissedFor: null,
      setAdjustment: (adjustment) => set({ adjustment }),
      dismiss: (sessionId) => set({ dismissedFor: sessionId, adjustment: null }),
    }),
    { name: 'workoutpro-readiness-note', partialize: (state) => ({ dismissedFor: state.dismissedFor }) }
  )
)

/**
 * Visible, dismissible note at the top of the workout when today's readiness
 * suggests a lighter session. It only changes the *suggested* weights shown on
 * each exercise (see useReadinessSuggestion); logged values are never touched.
 */
export function ReadinessLoadNote({ sessionId }: { sessionId: string }) {
  const [now] = useState(() => new Date())
  const readiness = useTodayReadiness(now)
  const dismissedFor = useReadinessNoteStore((state) => state.dismissedFor)
  const setAdjustment = useReadinessNoteStore((state) => state.setAdjustment)
  const dismiss = useReadinessNoteStore((state) => state.dismiss)
  const adjustment = useMemo(() => readinessLoadAdjustment(readiness), [readiness])
  const active = adjustment.multiplier < 1 && dismissedFor !== sessionId

  useEffect(() => {
    setAdjustment(active ? adjustment : null)
  }, [active, adjustment, setAdjustment])

  useEffect(() => () => setAdjustment(null), [setAdjustment])

  if (!active || !adjustment.message) return null
  const reasons = readiness?.recommendation.reasons.filter((reason) => reason.tone === 'negative').slice(0, 2) ?? []
  return (
    <aside
      aria-label="Ajuste pela prontidão"
      className="mt-5 flex items-start gap-3 rounded-[var(--radius-md)] bg-[var(--warning-soft)] py-3 pl-4 pr-2"
    >
      <div className="min-w-0 flex-1">
        <p className="subhead font-semibold text-[var(--warning)]">{adjustment.message}</p>
        {reasons.length > 0 && <p className="footnote mt-0.5 text-[var(--muted-strong)]">{reasons.map((reason) => reason.text).join(' · ')}.</p>}
        <p className="footnote mt-0.5 text-[var(--muted)]">As cargas sugeridas já consideram isso. Você decide o que registrar.</p>
      </div>
      <button
        type="button"
        onClick={() => dismiss(sessionId)}
        className="-my-1 flex h-11 w-11 flex-none items-center justify-center rounded-full text-[var(--muted)]"
        aria-label="Dispensar ajuste pela prontidão"
      >
        <X size={18} aria-hidden />
      </button>
    </aside>
  )
}

/** The progression suggestion with today's readiness adjustment applied (if any, and not dismissed). */
export function useReadinessSuggestion(suggestion: ProgressionSuggestion | null): AdjustedSuggestion | null {
  const adjustment = useReadinessNoteStore((state) => state.adjustment)
  return useMemo(() => applyReadinessToSuggestion(suggestion, adjustment), [adjustment, suggestion])
}
