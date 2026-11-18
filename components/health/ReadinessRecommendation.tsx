'use client'

import { AlertCircle, Check, Minus } from 'lucide-react'
import { loadAdjustmentFor, type Readiness } from '@/lib/readiness'

const TONE_CLASS = {
  positive: 'text-[var(--success)]',
  neutral: 'text-[var(--muted)]',
  negative: 'text-[var(--warning)]',
} as const

/** Recommendation level with the reasons behind it and the suggested load change. */
export function ReadinessRecommendation({ readiness }: { readiness: Readiness }) {
  const { recommendation } = readiness
  const adjustment = loadAdjustmentFor(recommendation.level)
  return (
    <div className="mt-6 border-t border-[var(--separator)] pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="headline">{recommendation.label}</p>
        <p className="footnote numeric text-[var(--muted)]">
          {adjustment.multiplier < 1
            ? `Carga −${Math.round((1 - adjustment.multiplier) * 100)}%${adjustment.setDelta < 0 ? ` · −${Math.abs(adjustment.setDelta)} série` : ''}`
            : 'Carga normal'}
        </p>
      </div>
      {recommendation.reasons.length > 0 && (
        <ul className="mt-2 space-y-1.5" aria-label="Motivos">
          {recommendation.reasons.map((reason) => {
            const Icon = reason.tone === 'positive' ? Check : reason.tone === 'negative' ? AlertCircle : Minus
            return (
              <li key={reason.text} className="subhead flex items-start gap-2">
                <Icon size={16} className={`mt-[3px] flex-none ${TONE_CLASS[reason.tone]}`} aria-hidden />
                <span>{reason.text}</span>
              </li>
            )
          })}
        </ul>
      )}
      {readiness.basis === 'training' && (
        <p className="footnote mt-3 text-[var(--muted)]">Calculada só com seus treinos. Conecte um relógio para incluir sono, HRV e FC em repouso.</p>
      )}
    </div>
  )
}
