'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronRight, Play } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/Button'
import { Input, TextArea } from '@/components/ui/Input'
import { LocalNav, SectionHeader } from '@/components/layout/PageHeader'
import { StrengthChart } from '@/components/insights/StrengthCard'
import { VideoModal } from '@/components/training/MediaViewer'
import { LibraryExerciseInfo } from '@/components/library/LibraryExerciseInfo'
import { findLibraryMatch } from '@/lib/exerciseLibrary'
import { useProfileStore } from '@/stores/useProfileStore'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { formatDate, formatDecimal, formatDuration, formatVolume } from '@/lib/utils'
import { getExerciseHistory, getExerciseRecords } from '@/lib/exerciseHistory'
import { listMedia } from '@/lib/media'
import type { MediaItem } from '@/types'

function ExerciseHistoryContent() {
  const id = useSearchParams().get('id') ?? ''
  const exercises = useWorkoutStore((state) => state.exercises)
  const workouts = useWorkoutStore((state) => state.workouts)
  const updateExercise = useWorkoutStore((state) => state.updateExercise)
  const sessions = useProfileStore((state) => state.sessions)
  const exercise = exercises.find((item) => item.id === id)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(exercise?.notes ?? '')
  const [equipment, setEquipment] = useState(exercise?.equipment ?? '')
  const [machineSettings, setMachineSettings] = useState(exercise?.machineSettings ?? '')
  const [alternatives, setAlternatives] = useState(exercise?.alternatives?.join(', ') ?? '')
  const [videos, setVideos] = useState<MediaItem[]>([])
  const [playing, setPlaying] = useState<MediaItem | null>(null)

  const history = useMemo(() => getExerciseHistory(id, sessions, workouts), [id, sessions, workouts])
  const records = useMemo(() => getExerciseRecords(history), [history])
  const library = exercise ? findLibraryMatch(exercise) : undefined

  useEffect(() => {
    if (!id) return
    void listMedia('video', id).then(setVideos).catch(() => setVideos([]))
  }, [id])

  function startEditing() {
    if (!exercise) return
    setNotes(exercise.notes ?? '')
    setEquipment(exercise.equipment ?? '')
    setMachineSettings(exercise.machineSettings ?? '')
    setAlternatives(exercise.alternatives?.join(', ') ?? '')
    setEditingNotes(true)
  }

  async function saveNotes() {
    if (!exercise) return
    await updateExercise(exercise.id, {
      notes,
      equipment: equipment.trim() || undefined,
      machineSettings: machineSettings.trim() || undefined,
      alternatives: alternatives.split(',').map((item) => item.trim()).filter(Boolean),
    })
    setEditingNotes(false)
  }

  if (!exercise) {
    return <div className="apple-page page-content pt-24"><p className="subhead text-center text-[var(--muted)]">Exercício não encontrado.</p></div>
  }

  return (
    <div className="apple-page page-content">
      <LocalNav title={exercise.name} back="/workouts" />

      <header className="hero">
        <p className="eyebrow-muted">{exercise.muscleGroup}{exercise.equipment ? ` · ${exercise.equipment}` : ''}</p>
        <h1 className="display mt-1">{exercise.name}</h1>
      </header>

      <section className="tile mt-8 grid grid-cols-2 gap-x-4 gap-y-6" aria-label="Recordes">
        {[
          ['Maior carga', records.bestWeight > 0 ? `${formatDecimal(records.bestWeight)}` : '—', 'kg'],
          ['1RM estimado', records.bestEstimatedOneRm > 0 ? formatDecimal(Math.round(records.bestEstimatedOneRm * 10) / 10) : '—', 'kg'],
          ['Melhor volume', formatVolume(records.bestVolume), ''],
          ['Sessões', `${records.sessions}`, ''],
        ].map(([label, value, unit]) => (
          <div key={label}>
            <p className="footnote text-[var(--muted)]">{label}</p>
            <p className="stat mt-1 text-[30px]">{value}{unit && value !== '—' ? <span className="stat-unit">{unit}</span> : null}</p>
          </div>
        ))}
      </section>

      {library && (
        <section aria-labelledby="technique-title" className="stack-section">
          <SectionHeader
            id="technique-title"
            title="Técnica."
            subtitle={exercise.libraryId ? 'Da biblioteca de exercícios.' : `Parece ser "${library.name}" da biblioteca.`}
            action={exercise.libraryId ? undefined : <button type="button" onClick={() => void updateExercise(exercise.id, { libraryId: library.id })} className="link -mb-2.5 flex-none text-[17px]">Vincular</button>}
          />
          <div className="tile">
            <LibraryExerciseInfo item={library} />
          </div>
        </section>
      )}

      <section aria-labelledby="strength-title" className="stack-section">
        <SectionHeader id="strength-title" title="Força." subtitle="1RM estimado por sessão e linha de tendência." />
        <div className="tile">
          <StrengthChart exerciseId={exercise.id} sessions={sessions} workouts={workouts} />
        </div>
      </section>

      {videos.length > 0 && (
        <section aria-labelledby="videos-title" className="stack-section">
          <SectionHeader id="videos-title" title="Vídeos." subtitle="Gravados neste aparelho durante os treinos." />
          <div className="list">
            {videos.map((video) => (
              <button key={video.id} type="button" onClick={() => setPlaying(video)} className="grouped-row sep-inset-72 flex min-h-14 w-full items-center gap-4 px-5 py-3 text-left">
                <span aria-hidden className="icon-chip rounded-full !bg-[var(--accent-soft)] !text-[var(--accent)]"><Play size={15} fill="currentColor" /></span>
                <span className="flex-1">{format(new Date(video.createdAt), "d 'de' MMMM, HH:mm", { locale: ptBR })}</span>
                <ChevronRight size={18} className="text-[var(--muted)]" aria-hidden />
              </button>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="notes-title" className="stack-section">
        <SectionHeader
          id="notes-title"
          title="Notas."
          action={editingNotes
            ? <Button size="sm" onClick={saveNotes} className="-mb-1">Salvar</Button>
            : <button type="button" onClick={startEditing} className="link -mb-2.5 text-[17px]">Editar</button>}
        />
        <div className="tile">
          {editingNotes ? (
            <div className="space-y-4">
              <Input label="Equipamento" value={equipment} onChange={(event) => setEquipment(event.target.value)} placeholder="Ex.: barra, halteres, máquina" />
              <Input label="Ajuste da máquina" value={machineSettings} onChange={(event) => setMachineSettings(event.target.value)} placeholder="Ex.: banco 3, encosto 5" />
              <Input label="Alternativas" value={alternatives} onChange={(event) => setAlternatives(event.target.value)} placeholder="Separe por vírgulas" hint="Aparecem primeiro quando você troca de exercício no treino." />
              <TextArea label="Notas" value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="Técnica, pegada e observações..." />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="body-text text-[var(--muted)]">{exercise.notes || 'Sem notas ainda. Use este espaço para técnica, pegada e observações.'}</p>
              {exercise.machineSettings && <p className="subhead"><span className="text-[var(--muted)]">Ajuste: </span>{exercise.machineSettings}</p>}
              {exercise.alternatives?.length ? <p className="subhead"><span className="text-[var(--muted)]">Alternativas: </span>{exercise.alternatives.join(', ')}</p> : null}
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="history-title" className="stack-section">
        <SectionHeader id="history-title" title="Histórico." />
        {history.length === 0 ? (
          <div className="tile text-center">
            <p className="headline">Nenhuma sessão registrada</p>
            <p className="footnote mt-1 text-[var(--muted)]">Finalize um treino com este exercício para ver o histórico.</p>
          </div>
        ) : (
          <div className="list">
            {history.map((entry) => (
              <Link key={entry.sessionId} href={`/workouts/detail?id=${entry.workoutId}`} className="grouped-row flex items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="headline truncate">{formatDate(entry.date)} · {entry.workoutName}</p>
                  <p className="footnote numeric mt-0.5 text-[var(--muted)]">
                    {entry.sets} séries · até {formatDecimal(entry.bestWeight)} kg · {formatDuration(entry.duration)}
                  </p>
                </div>
                <span className="stat flex-none text-[18px]">{formatVolume(entry.volume)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <VideoModal mediaId={playing?.id ?? null} title={playing ? format(new Date(playing.createdAt), "d 'de' MMMM", { locale: ptBR }) : 'Vídeo'} onClose={() => setPlaying(null)} />
    </div>
  )
}

export default function ExerciseHistoryPage() {
  return <Suspense fallback={null}><ExerciseHistoryContent /></Suspense>
}
