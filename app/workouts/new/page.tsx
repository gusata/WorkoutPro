'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, Check, ChevronRight, Plus, Search, Sparkles, WandSparkles } from 'lucide-react'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { Button } from '@/components/ui/Button'
import { Input, Select, TextArea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Hero, LocalNav } from '@/components/layout/PageHeader'
import { MUSCLE_GROUPS, readableOn, WORKOUT_COLORS } from '@/lib/utils'
import { exerciseMatches } from '@/lib/training'
import { WORKOUT_TEMPLATES, type WorkoutTemplate } from '@/lib/workoutTemplates'
import { LibraryPicker } from '@/components/library/LibraryPicker'
import { EQUIPMENT_LABELS, findLibraryMatch, type LibraryExercise } from '@/lib/exerciseLibrary'
import { normalizeExerciseName } from '@/lib/exerciseCandidates'
import type { MuscleGroup, WorkoutExerciseConfig } from '@/types'

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const WEEKDAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const COLOR_NAMES: Record<string, string> = {
  '#6366f1': 'índigo', '#f43f5e': 'rosa', '#f97316': 'laranja', '#eab308': 'amarelo', '#22c55e': 'verde',
  '#14b8a6': 'verde-azulado', '#06b6d4': 'ciano', '#8b5cf6': 'violeta', '#ec4899': 'pink', '#84cc16': 'lima',
}

export default function NewWorkoutPage() {
  const router = useRouter()
  const exercises = useWorkoutStore((state) => state.exercises)
  const addWorkout = useWorkoutStore((state) => state.addWorkout)
  const addExercise = useWorkoutStore((state) => state.addExercise)
  const updateExercise = useWorkoutStore((state) => state.updateExercise)
  const addLibraryExercise = useWorkoutStore((state) => state.addLibraryExercise)
  const [name, setName] = useState('')
  const [color, setColor] = useState(WORKOUT_COLORS[0])
  const [selected, setSelected] = useState<string[]>([])
  const [configs, setConfigs] = useState<Record<string, WorkoutExerciseConfig>>({})
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('Todos')
  const [saving, setSaving] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [exName, setExName] = useState('')
  const [exMuscle, setExMuscle] = useState<MuscleGroup>(MUSCLE_GROUPS[0])
  const [exNotes, setExNotes] = useState('')

  const filtered = useMemo(() => exercises.filter((exercise) =>
    (muscle === 'Todos' || exercise.muscleGroup === muscle) && exerciseMatches(exercise.name, query)
  ), [exercises, muscle, query])

  const selectedLibraryIds = useMemo(() => new Set(exercises.filter((exercise) => exercise.libraryId && selected.includes(exercise.id)).map((exercise) => exercise.libraryId!)), [exercises, selected])

  async function addFromLibrary(item: LibraryExercise) {
    const id = await addLibraryExercise(item.id)
    if (!selected.includes(id)) toggleExercise(id)
  }

  function toggleExercise(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
    setConfigs((current) => current[id] ? current : ({ ...current, [id]: { exerciseId: id, targetSets: 3, minReps: 8, maxReps: 12, restSeconds: 90, supersetId: null, progression: { type: 'double-progression', increment: 2.5, minimumRir: 1 } } }))
  }

  async function save() {
    if (!name.trim() || selected.length === 0 || saving) return
    setSaving(true)
    try {
      const id = await addWorkout({ name: name.trim(), color, icon: 'Dumbbell', exerciseIds: selected, exerciseConfigs: selected.map((exerciseId) => configs[exerciseId]), scheduledWeekdays: weekdays })
      router.push(`/workouts/detail?id=${id}`)
    } catch {
      setSaving(false)
    }
  }

  async function fromTemplate(template: WorkoutTemplate) {
    if (saving) return
    setSaving(true)
    const ids: string[] = []
    for (const item of template.exercises) {
      const library = findLibraryMatch({ name: item.name })
      const existing = exercises.find((exercise) => normalizeExerciseName(exercise.name) === normalizeExerciseName(item.name))
        ?? (library ? exercises.find((exercise) => exercise.libraryId === library.id) : undefined)
      if (existing) {
        ids.push(existing.id)
        const updates = { ...(!existing.notes && item.notes ? { notes: item.notes } : {}), ...(library && !existing.libraryId ? { libraryId: library.id } : {}) }
        if (Object.keys(updates).length) await updateExercise(existing.id, updates)
      } else ids.push(await addExercise({ name: item.name, muscleGroup: item.muscleGroup, notes: item.notes, ...(library ? { libraryId: library.id, equipment: EQUIPMENT_LABELS[library.equipment] } : {}) }))
    }
    const exerciseConfigs = ids.map((exerciseId) => ({ exerciseId, targetSets: 3, minReps: 8, maxReps: 12, restSeconds: 90, supersetId: null, progression: { type: 'double-progression' as const, increment: 2.5, minimumRir: 1 } }))
    const id = await addWorkout({ name: template.name, color: template.color, icon: 'Dumbbell', exerciseIds: ids, exerciseConfigs, scheduledWeekdays: [] })
    router.push(`/workouts/detail?id=${id}`)
  }

  async function createExercise() {
    if (!exName.trim()) return
    const id = await addExercise({ name: exName.trim(), muscleGroup: exMuscle, notes: exNotes })
    toggleExercise(id); setExName(''); setExNotes(''); setShowCreate(false)
  }

  return (
    <div className="apple-page page-content page-narrow">
      <LocalNav
        title="Novo treino"
        back="/workouts"
        actions={<button type="button" onClick={save} disabled={!name.trim() || selected.length === 0 || saving} className="pill">{saving ? 'Salvando' : 'Criar'}</button>}
      />
      <Hero eyebrow="Biblioteca" title="Novo treino." lede="Dê um nome, escolha os exercícios e, se quiser, os dias da semana." />

      <button type="button" onClick={() => setShowTemplates(true)} className="tile tile-dark tile-link mt-8 flex w-full items-center gap-4 !py-6 text-left">
        <span aria-hidden className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white/12 text-[#ff8a3d]"><Sparkles size={19} /></span>
        <span className="min-w-0 flex-1">
          <span className="headline block text-[#f5f5f7]">Começar com um modelo</span>
          <span className="footnote block text-[#a1a1a6]">Rotinas enxutas para diferentes frequências</span>
        </span>
        <ChevronRight size={18} className="text-[#2997ff]" aria-hidden />
      </button>
      <Link href="/workouts/generate" className="tile tile-link mt-3 flex w-full items-center gap-4 !py-5 text-left">
        <span aria-hidden className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]"><WandSparkles size={19} /></span>
        <span className="min-w-0 flex-1">
          <span className="headline block">Gerar rotina completa</span>
          <span className="footnote block text-[var(--muted)]">Escolha dias, objetivo e equipamentos</span>
        </span>
        <ChevronRight size={18} className="text-[var(--muted)]" aria-hidden />
      </Link>

      <section className="stack-section space-y-6" aria-label="Detalhes">
        <Input label="Nome da rotina" placeholder="Ex.: Superior A" value={name} onChange={(event) => setName(event.target.value)} hint={selected.length === 0 ? 'Selecione ao menos um exercício abaixo para criar.' : `${selected.length} exercício${selected.length > 1 ? 's' : ''} selecionado${selected.length > 1 ? 's' : ''}.`} />
        <fieldset>
          <legend className="mb-2 px-1 text-[13px] font-semibold text-[var(--muted)]">Cor</legend>
          <div className="flex flex-wrap gap-1">{WORKOUT_COLORS.map((item) => <button key={item} type="button" onClick={() => setColor(item)} aria-pressed={color === item} className="flex h-11 w-11 items-center justify-center rounded-full" aria-label={`Cor ${COLOR_NAMES[item] ?? item}`}><span className="flex h-7 w-7 items-center justify-center rounded-full transition-transform" style={{ background: item, color: readableOn(item), boxShadow: color === item ? `0 0 0 2px var(--background), 0 0 0 4px ${item}` : undefined }}>{color === item && <Check size={14} strokeWidth={3} aria-hidden />}</span></button>)}</div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 px-1 text-[13px] font-semibold text-[var(--muted)]">Dias da semana (opcional)</legend>
          <div className="grid grid-cols-7 gap-1.5">{WEEKDAYS.map((day, index) => <button key={index} type="button" aria-pressed={weekdays.includes(index)} aria-label={WEEKDAY_NAMES[index]} onClick={() => setWeekdays((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index])} className={`h-11 rounded-full text-[15px] font-semibold transition-colors ${weekdays.includes(index) ? 'bg-[var(--foreground)] text-[var(--background-elevated)]' : 'bg-[var(--fill-strong)]'}`}>{day}</button>)}</div>
        </fieldset>
      </section>

      <section className="stack-section" aria-labelledby="exercises-title">
        <div className="mb-4 flex items-end justify-between px-1"><h2 id="exercises-title" className="section-title">Exercícios.</h2><div className="-mb-2.5 flex gap-4"><button type="button" onClick={() => setShowLibrary(true)} className="link text-[17px]"><BookOpen size={17} aria-hidden />Biblioteca</button><button type="button" onClick={() => setShowCreate(true)} className="link text-[17px]"><Plus size={17} aria-hidden />Novo</button></div></div>
        <label className="relative mb-3 block"><span className="sr-only">Buscar exercício</span><Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar" className="field !pl-11" /></label>
        <div className="scroll-row mb-4" role="group" aria-label="Filtrar por grupo muscular">
          {['Todos', ...MUSCLE_GROUPS].map((item) => <button key={item} type="button" aria-pressed={muscle === item} onClick={() => setMuscle(item)} className="chip">{item}</button>)}
        </div>
        <div className="list max-h-[29rem] overflow-y-auto">{filtered.map((exercise) => {
          const checked = selected.includes(exercise.id)
          return <button key={exercise.id} type="button" aria-label={`${checked ? 'Remover' : 'Selecionar'} ${exercise.name}`} onClick={() => toggleExercise(exercise.id)} aria-pressed={checked} className="grouped-row flex min-h-14 w-full items-center gap-4 px-5 py-3 text-left"><span className="min-w-0 flex-1"><span className="block truncate">{exercise.name}</span><span className="footnote text-[var(--muted)]">{exercise.muscleGroup}{exercise.equipment ? ` · ${exercise.equipment}` : ''}</span></span><span aria-hidden className={`flex h-6 w-6 flex-none items-center justify-center rounded-full transition-colors ${checked ? 'bg-[var(--accent-fill)] text-white' : 'shadow-[inset_0_0_0_1.5px_var(--separator)]'}`}>{checked && <Check size={14} strokeWidth={3} />}</span></button>
        })}{filtered.length === 0 && <p className="subhead p-8 text-center text-[var(--muted)]">Nenhum exercício encontrado. <button type="button" onClick={() => setShowLibrary(true)} className="text-[var(--accent)]">Procure na biblioteca</button>.</p>}</div>
      </section>

      <Modal open={showTemplates} onClose={() => setShowTemplates(false)} title="Modelos"><div className="list !bg-[var(--fill)]">{WORKOUT_TEMPLATES.map((template) => <button key={template.id} type="button" onClick={() => void fromTemplate(template)} disabled={saving} className="grouped-row flex min-h-16 w-full items-center gap-4 px-4 py-3 text-left disabled:opacity-50"><span aria-hidden className="h-8 w-1.5 flex-none rounded-full" style={{ background: template.color }} /><span className="flex-1"><span className="headline block">{template.name}</span><span className="footnote text-[var(--muted)]">{template.frequency} · {template.exercises.length} exercícios</span></span><ChevronRight size={17} className="text-[var(--muted)]" aria-hidden /></button>)}</div></Modal>
      <Modal open={showLibrary} onClose={() => setShowLibrary(false)} title="Biblioteca"><LibraryPicker inSheet addedIds={selectedLibraryIds} onAdd={addFromLibrary} addLabel="Adicionar à rotina" addedLabel="Na rotina" /></Modal>
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Novo exercício"><div className="space-y-4"><Input label="Nome" value={exName} onChange={(event) => setExName(event.target.value)} /><Select label="Grupo muscular" value={exMuscle} onChange={(event) => setExMuscle(event.target.value as MuscleGroup)} options={MUSCLE_GROUPS.map((item) => ({ value: item, label: item }))} /><TextArea label="Notas" value={exNotes} onChange={(event) => setExNotes(event.target.value)} rows={2} /><Button size="lg" className="w-full" onClick={createExercise} disabled={!exName.trim()}>Criar e selecionar</Button></div></Modal>
    </div>
  )
}
