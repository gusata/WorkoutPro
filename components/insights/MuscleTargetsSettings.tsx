'use client'

import { Minus, Plus } from 'lucide-react'
import { useProfileStore } from '@/stores/useProfileStore'
import { DEFAULT_MUSCLE_TARGETS, getMuscleTargets, MUSCLES, type Muscle } from '@/lib/muscleVolume'
import type { MuscleTargetRange } from '@/types'

const MAX_SETS = 40

function MiniStepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <span className="flex flex-none items-center" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} className="flex h-11 w-9 items-center justify-center text-[var(--accent)] disabled:opacity-30" aria-label={`Diminuir ${label}`}>
        <Minus size={15} aria-hidden />
      </button>
      <output className="numeric w-7 text-center text-[17px] font-semibold" aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} className="flex h-11 w-9 items-center justify-center text-[var(--accent)] disabled:opacity-30" aria-label={`Aumentar ${label}`}>
        <Plus size={15} aria-hidden />
      </button>
    </span>
  )
}

/** Weekly set range per muscle, stored in profile.preferences.muscleTargets. */
export function MuscleTargetsSettings() {
  const preferences = useProfileStore((state) => state.profile?.preferences)
  const updatePreferences = useProfileStore((state) => state.updatePreferences)
  const targets = getMuscleTargets(preferences)
  const customized = Object.keys(preferences?.muscleTargets ?? {}).length > 0

  function setTarget(muscle: Muscle, range: MuscleTargetRange) {
    const next = { ...(preferences?.muscleTargets ?? {}) }
    const fallback = DEFAULT_MUSCLE_TARGETS[muscle]
    if (range.min === fallback.min && range.max === fallback.max) delete next[muscle]
    else next[muscle] = range
    void updatePreferences({ muscleTargets: next })
  }

  return (
    <section id="volume-muscular" aria-labelledby="muscle-targets-title" className="stack-section scroll-mt-20">
      <h2 id="muscle-targets-title" className="list-header">Volume por músculo</h2>
      <div className="list">
        {MUSCLES.map((muscle) => {
          const range = targets[muscle]
          return (
            <div key={muscle} className="grouped-row flex min-h-14 items-center gap-2 py-1.5 pl-5 pr-2">
              <span className="min-w-0 flex-1 truncate">{muscle}</span>
              <MiniStepper label={`Mínimo de ${muscle}`} value={range.min} min={0} max={range.max} onChange={(min) => setTarget(muscle, { ...range, min })} />
              <span aria-hidden className="text-[var(--muted)]">–</span>
              <MiniStepper label={`Máximo de ${muscle}`} value={range.max} min={Math.max(1, range.min)} max={MAX_SETS} onChange={(max) => setTarget(muscle, { ...range, max })} />
            </div>
          )
        })}
      </div>
      <p className="list-footer">
        Séries de trabalho por semana, usadas em Progresso e na tela Hoje. Padrão: 10–20 para músculos grandes e 6–12 para os menores.
        {customized && (
          <>
            {' '}
            <button type="button" className="link text-[13px]" onClick={() => void updatePreferences({ muscleTargets: {} })}>Restaurar padrão</button>
          </>
        )}
      </p>
    </section>
  )
}
