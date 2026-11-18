'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Hero, LocalNav } from '@/components/layout/PageHeader'
import { LibraryPicker } from '@/components/library/LibraryPicker'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { findUserExerciseForLibrary, LIBRARY, type LibraryExercise } from '@/lib/exerciseLibrary'

export default function ExerciseLibraryPage() {
  const exercises = useWorkoutStore((state) => state.exercises)
  const addLibraryExercise = useWorkoutStore((state) => state.addLibraryExercise)
  const [message, setMessage] = useState<string | null>(null)

  // Linked exercises plus legacy ones with an exact name match count as "already added".
  const addedIds = useMemo(() => new Set(LIBRARY.filter((item) => findUserExerciseForLibrary(exercises, item)).map((item) => item.id)), [exercises])

  async function add(item: LibraryExercise) {
    try {
      await addLibraryExercise(item.id)
      setMessage(`${item.name} adicionado aos seus exercícios.`)
    } catch {
      setMessage('Não foi possível adicionar. Tente novamente.')
    }
  }

  function openExisting(item: LibraryExercise) {
    const existing = findUserExerciseForLibrary(exercises, item)
    if (!existing) return null
    return (
      <Link href={`/exercises/detail?id=${existing.id}`} className="link w-full justify-center text-[17px]">
        Abrir histórico do exercício<ChevronRight size={17} aria-hidden />
      </Link>
    )
  }

  return (
    <div className="apple-page page-content page-narrow">
      <LocalNav title="Biblioteca" back="/workouts" />
      <Hero eyebrow="Exercícios" title="Biblioteca." lede={`${LIBRARY.length} exercícios com execução, erros comuns e ilustrações. Adicione aos seus para usar nas rotinas.`} />
      <p className="sr-only" role="status">{message ?? ''}</p>
      <section className="stack-section" aria-label="Catálogo de exercícios">
        <LibraryPicker
          addedIds={addedIds}
          onAdd={add}
          addLabel="Adicionar aos meus exercícios"
          addedLabel="Nos seus exercícios"
          detail="modal"
          addedAction={openExisting}
        />
      </section>
    </div>
  )
}
