'use client'

import { AlertTriangle } from 'lucide-react'
import { ExerciseIllustration } from '@/components/library/ExerciseIllustration'
import { EQUIPMENT_LABELS, LEVEL_LABELS, MECHANIC_LABELS, type LibraryExercise } from '@/lib/exerciseLibrary'

/** Illustration, tags, execution steps and common mistakes of a library exercise. */
export function LibraryExerciseInfo({ item, showIllustration = true }: { item: LibraryExercise; showIllustration?: boolean }) {
  const tags = [item.muscleGroup, EQUIPMENT_LABELS[item.equipment], MECHANIC_LABELS[item.mechanic], LEVEL_LABELS[item.level]]
  return (
    <div className="space-y-6">
      {showIllustration && <ExerciseIllustration key={item.id} item={item} />}

      <div>
        <ul className="flex flex-wrap gap-1.5" aria-label="Características">
          {tags.map((tag) => <li key={tag} className="caption rounded-full bg-[var(--fill)] px-2.5 py-1 font-semibold text-[var(--muted-strong)]">{tag}</li>)}
        </ul>
        {item.secondaryMuscles.length > 0 && (
          <p className="footnote mt-3 text-[var(--muted)]"><span className="font-semibold">Também trabalha: </span>{item.secondaryMuscles.join(', ')}</p>
        )}
      </div>

      <div>
        <h3 className="headline mb-2">Execução</h3>
        <ol className="space-y-2.5">
          {item.instructions.map((step, index) => (
            <li key={index} className="flex gap-3">
              <span aria-hidden className="numeric flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[var(--accent-soft)] text-[13px] font-semibold text-[var(--accent)]">{index + 1}</span>
              <span className="subhead">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <h3 className="headline mb-2">Erros comuns</h3>
        <ul className="space-y-2">
          {item.mistakes.map((mistake) => (
            <li key={mistake} className="flex gap-3">
              <AlertTriangle size={16} aria-hidden className="mt-0.5 flex-none text-[var(--warning)]" />
              <span className="subhead">{mistake}</span>
            </li>
          ))}
        </ul>
      </div>

      {item.imageId && <p className="caption text-[var(--muted)]">Imagens: free-exercise-db (domínio público).</p>}
    </div>
  )
}
