'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Check, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { LibraryExerciseInfo } from '@/components/library/LibraryExerciseInfo'
import { cn } from '@/lib/cn'
import { MUSCLE_GROUPS } from '@/lib/utils'
import { EQUIPMENT_LABELS, LIBRARY_EQUIPMENT, searchLibrary, type LibraryEquipment, type LibraryExercise } from '@/lib/exerciseLibrary'
import type { MuscleGroup } from '@/types'

interface LibraryPickerProps {
  /** Library ids that are already added (shown with a check instead of "+"). */
  addedIds: ReadonlySet<string>
  onAdd: (item: LibraryExercise) => Promise<void> | void
  addLabel: string
  addedLabel?: string
  /** `inline` swaps the list for the detail (inside a sheet); `modal` opens the detail in a sheet. */
  detail?: 'inline' | 'modal'
  /** Extra action shown in the detail of an already-added exercise. */
  addedAction?: (item: LibraryExercise) => ReactNode
  /** Styling for use inside a sheet (filled fields, scrollable list). */
  inSheet?: boolean
}

export function LibraryPicker({ addedIds, onAdd, addLabel, addedLabel = 'Adicionado', detail = 'inline', addedAction, inSheet = false }: LibraryPickerProps) {
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null)
  const [equipment, setEquipment] = useState<LibraryEquipment | null>(null)
  const [viewing, setViewing] = useState<LibraryExercise | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const results = useMemo(() => searchLibrary(query, { muscleGroup: muscle, equipment }), [query, muscle, equipment])

  async function add(item: LibraryExercise) {
    if (busy) return
    setBusy(item.id)
    try {
      await onAdd(item)
    } finally {
      setBusy(null)
    }
  }

  function detailBody(item: LibraryExercise) {
    const added = addedIds.has(item.id)
    return (
      <>
        <LibraryExerciseInfo item={item} />
        <div className="mt-6 space-y-2">
          <Button size="lg" className="w-full" onClick={() => void add(item)} disabled={added || busy === item.id}>
            {added ? <><Check size={16} aria-hidden />{addedLabel}</> : <><Plus size={16} aria-hidden />{addLabel}</>}
          </Button>
          {added && addedAction?.(item)}
        </div>
      </>
    )
  }

  if (detail === 'inline' && viewing) {
    return (
      <div>
        <button type="button" onClick={() => setViewing(null)} className="link -ml-1 mb-2 text-[17px]"><ChevronLeft size={18} aria-hidden />Biblioteca</button>
        <h3 className="title-3 mb-4">{viewing.name}</h3>
        {detailBody(viewing)}
      </div>
    )
  }

  return (
    <div>
      <label className="relative mb-3 block">
        <span className="sr-only">Buscar na biblioteca</span>
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar: supino, puxada, glúteo..." className={cn('field !pl-11', inSheet && 'field-filled')} />
      </label>
      <div className="scroll-row mb-2" role="group" aria-label="Filtrar por grupo muscular">
        <button type="button" aria-pressed={muscle === null} onClick={() => setMuscle(null)} className="chip">Todos</button>
        {MUSCLE_GROUPS.map((item) => <button key={item} type="button" aria-pressed={muscle === item} onClick={() => setMuscle(muscle === item ? null : item)} className="chip">{item}</button>)}
      </div>
      <div className="scroll-row mb-3" role="group" aria-label="Filtrar por equipamento">
        <button type="button" aria-pressed={equipment === null} onClick={() => setEquipment(null)} className="chip">Qualquer equipamento</button>
        {LIBRARY_EQUIPMENT.map((item) => <button key={item} type="button" aria-pressed={equipment === item} onClick={() => setEquipment(equipment === item ? null : item)} className="chip">{EQUIPMENT_LABELS[item]}</button>)}
      </div>
      <p className="footnote mb-2 px-1 text-[var(--muted)]" aria-live="polite">{results.length} {results.length === 1 ? 'exercício' : 'exercícios'}</p>
      <div className={cn('list', inSheet && 'max-h-[26rem] overflow-y-auto !bg-[var(--fill)]')}>
        {results.map((item) => {
          const added = addedIds.has(item.id)
          return (
            <div key={item.id} className="grouped-row flex min-h-14 items-center">
              <button type="button" onClick={() => setViewing(item)} className="flex min-h-14 min-w-0 flex-1 items-center gap-2 py-3 pl-4 text-left" aria-label={`Ver ${item.name}`}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.name}</span>
                  <span className="footnote block truncate text-[var(--muted)]">{item.muscleGroup} · {EQUIPMENT_LABELS[item.equipment]}</span>
                </span>
                <ChevronRight size={16} className="flex-none text-[var(--muted)]" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => void add(item)}
                disabled={added || busy === item.id}
                className="flex h-12 w-12 flex-none items-center justify-center text-[var(--accent)] disabled:text-[var(--success)]"
                aria-label={added ? `${item.name}: ${addedLabel.toLowerCase()}` : `${addLabel}: ${item.name}`}
              >
                {added ? <Check size={18} strokeWidth={2.6} aria-hidden /> : <Plus size={19} aria-hidden />}
              </button>
            </div>
          )
        })}
        {results.length === 0 && <p className="subhead p-8 text-center text-[var(--muted)]">Nenhum exercício encontrado.</p>}
      </div>

      {detail === 'modal' && (
        <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing?.name}>
          {viewing && detailBody(viewing)}
        </Modal>
      )}
    </div>
  )
}
