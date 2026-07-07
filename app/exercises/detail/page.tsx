'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { ArrowLeft, CalendarDays, Dumbbell, Edit3, Save, Trophy, Weight, Zap } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { TextArea } from '@/components/ui/Input'
import { useProfileStore } from '@/stores/useProfileStore'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { formatDate, formatDuration, formatVolume } from '@/lib/utils'
import { getExerciseHistory, getExerciseRecords } from '@/lib/exerciseHistory'

function RecordCard({ icon: Icon, label, value }: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <Card className="p-4">
      <div className="soft-icon mb-3 flex h-9 w-9 items-center justify-center rounded-2xl">
        <Icon size={16} />
      </div>
      <p className="text-xl font-bold text-[var(--foreground)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{label}</p>
    </Card>
  )
}

function ExerciseHistoryContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''
  const router = useRouter()
  const { exercises, workouts, updateExercise } = useWorkoutStore()
  const { sessions } = useProfileStore()
  const exercise = exercises.find((item) => item.id === id)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(exercise?.notes ?? '')

  const history = useMemo(
    () => getExerciseHistory(id, sessions, workouts),
    [id, sessions, workouts]
  )
  const records = useMemo(() => getExerciseRecords(history), [history])

  async function saveNotes() {
    if (!exercise) return
    await updateExercise(exercise.id, { notes })
    setEditingNotes(false)
  }

  if (!exercise) {
    return (
      <div className="apple-page page-content flex min-h-screen items-center justify-center">
        <p className="text-sm text-[var(--muted)]">Exercicio nao encontrado.</p>
      </div>
    )
  }

  return (
    <div className="apple-page page-content space-y-5 pb-28">
      <header className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--muted)]"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{exercise.muscleGroup}</p>
          <h1 className="truncate text-2xl font-bold text-[var(--foreground)]">{exercise.name}</h1>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <RecordCard icon={Weight} label="Maior carga" value={records.bestWeight > 0 ? `${records.bestWeight} kg` : '-'} />
        <RecordCard icon={Zap} label="Estimativa 1RM" value={records.bestEstimatedOneRm > 0 ? `${records.bestEstimatedOneRm.toFixed(1)} kg` : '-'} />
        <RecordCard icon={Trophy} label="Melhor volume" value={formatVolume(records.bestVolume)} />
        <RecordCard icon={Dumbbell} label="Sessoes" value={`${records.sessions}`} />
      </section>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="apple-section-title">Notas</h2>
          {editingNotes ? (
            <Button size="sm" onClick={saveNotes}>
              <Save size={14} />
              Salvar
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setEditingNotes(true)}>
              <Edit3 size={14} />
              Editar
            </Button>
          )}
        </div>
        {editingNotes ? (
          <TextArea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            placeholder="Ex: banco no pino 3, pegada media, controlar a descida..."
          />
        ) : (
          <p className="text-sm text-[var(--muted)]">
            {exercise.notes || 'Sem notas ainda. Use este espaco para tecnica, ajuste de maquina, pegada e observacoes.'}
          </p>
        )}
      </Card>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-[var(--accent)]" />
          <h2 className="apple-section-title">Historico</h2>
        </div>

        {history.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm font-semibold text-[var(--foreground)]">Nenhuma sessao registrada</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Finalize um treino com este exercicio para ver o historico.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {history.map((entry) => (
              <Card key={entry.sessionId} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-[var(--foreground)]">{entry.workoutName}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {formatDate(entry.date)} - {formatDuration(entry.duration)}
                    </p>
                  </div>
                  <Link href={`/workouts/detail?id=${entry.workoutId}`} className="text-xs font-bold text-[var(--accent)]">
                    Ver treino
                  </Link>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-[var(--surface-2)] p-2">
                    <p className="text-sm font-bold text-[var(--foreground)]">{entry.sets}</p>
                    <p className="text-[10px] text-[var(--muted)]">series</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--surface-2)] p-2">
                    <p className="text-sm font-bold text-[var(--foreground)]">{entry.bestWeight} kg</p>
                    <p className="text-[10px] text-[var(--muted)]">carga</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--surface-2)] p-2">
                    <p className="text-sm font-bold text-[var(--foreground)]">{formatVolume(entry.volume)}</p>
                    <p className="text-[10px] text-[var(--muted)]">volume</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default function ExerciseHistoryPage() {
  return (
    <Suspense fallback={null}>
      <ExerciseHistoryContent />
    </Suspense>
  )
}
