'use client'

import { findLibraryMatch, suggestLibraryAlternatives } from '@/lib/exerciseLibrary'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, RefreshCw, Shuffle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DecimalInput } from '@/components/ui/DecimalInput'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Hero, LocalNav } from '@/components/layout/PageHeader'
import { useProfileStore } from '@/stores/useProfileStore'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import {
  EQUIPMENT_LABEL, EQUIPMENT_OPTIONS, EQUIPMENT_SHORT, equipmentFromProfile, getExerciseCandidates, normalizeExerciseName, type EquipmentKind,
} from '@/lib/exerciseCandidates'
import {
  chooseSplit, estimateDayMinutes, EXPERIENCE_OPTIONS, generateRoutine, noteForCandidate, planToWorkouts, resolvePlanExercises,
  type ExperienceLevel, type GeneratedDay, type GeneratedPlan,
} from '@/lib/routineGenerator'
import { TRAINING_GOALS } from '@/lib/trainingBlocks'
import type { TrainingGoal } from '@/types'

const DAY_OPTIONS = ['2', '3', '4', '5', '6'].map((value) => ({ value, label: `${value}x` }))
const LENGTH_OPTIONS = ['30', '45', '60', '75', '90'].map((value) => ({ value, label: `${value} min` }))
const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const WEEKDAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const STEPS = ['Frequência', 'Objetivo', 'Sessão', 'Revisar']

export default function GenerateRoutinePage() {
  const router = useRouter()
  const exercises = useWorkoutStore((state) => state.exercises)
  const addExercise = useWorkoutStore((state) => state.addExercise)
  const addWorkout = useWorkoutStore((state) => state.addWorkout)
  const profileEquipment = useProfileStore((state) => state.profile?.availableEquipment)
  const [step, setStep] = useState(0)
  const [days, setDays] = useState('3')
  const [goal, setGoal] = useState<TrainingGoal>('hipertrofia')
  const [experience, setExperience] = useState<ExperienceLevel>('intermediario')
  const [minutes, setMinutes] = useState('60')
  const [equipment, setEquipment] = useState<EquipmentKind[] | null>(null)
  const [plan, setPlan] = useState<GeneratedPlan | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedEquipment = equipment ?? equipmentFromProfile(profileEquipment)
  const split = chooseSplit(Number(days))
  const pool = useMemo(() => getExerciseCandidates(exercises), [exercises])

  function generate() {
    setPlan(generateRoutine({ daysPerWeek: Number(days), goal, experience, sessionMinutes: Number(minutes), equipment: selectedEquipment }, pool))
    setStep(3)
  }

  function toggleEquipment(kind: EquipmentKind) {
    setEquipment(selectedEquipment.includes(kind) ? selectedEquipment.filter((item) => item !== kind) : [...selectedEquipment, kind])
  }

  function updateDay(key: string, updater: (day: GeneratedDay) => GeneratedDay) {
    setPlan((current) => current && { ...current, days: current.days.map((day) => (day.key === key ? updater(day) : day)) })
  }

  async function save() {
    if (!plan || saving) return
    setSaving(true)
    setError(null)
    try {
      // Reuse exercises the user already has; create each missing one exactly once.
      const resolved = resolvePlanExercises(plan, exercises)
      const ids = new Map(resolved.existing)
      for (const candidate of resolved.toCreate) {
        const library = findLibraryMatch({ name: candidate.name })
        const id = await addExercise({
          name: candidate.name, muscleGroup: candidate.muscleGroup, notes: noteForCandidate(candidate), equipment: EQUIPMENT_SHORT[candidate.equipment],
          ...(library ? { libraryId: library.id, alternatives: suggestLibraryAlternatives(library).map((item) => item.name) } : {}),
        })
        ids.set(normalizeExerciseName(candidate.name), id)
      }
      for (const workout of planToWorkouts(plan, ids)) await addWorkout(workout)
      router.push('/workouts')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar as rotinas.')
      setSaving(false)
    }
  }

  const totalExercises = plan?.days.reduce((sum, day) => sum + day.exercises.length, 0) ?? 0

  return (
    <div className="apple-page page-content page-narrow">
      <LocalNav
        title="Gerar rotina"
        back="/workouts"
        actions={step === 3 && plan ? <button type="button" onClick={() => void save()} disabled={saving || totalExercises === 0} className="pill">{saving ? 'Salvando' : 'Salvar'}</button> : undefined}
      />
      <Hero eyebrow={`Passo ${step + 1} de ${STEPS.length} · ${STEPS[step]}`} title="Gerar rotina." lede="Responda quatro perguntas e revise a divisão antes de salvar." />

      {step === 0 && (
        <section className="stack-section space-y-5" aria-label="Frequência">
          <div>
            <p className="mb-2 px-1 text-[13px] font-semibold text-[var(--muted)]">Dias de treino por semana</p>
            <SegmentedControl label="Dias por semana" value={days} onChange={setDays} options={DAY_OPTIONS} />
          </div>
          <div className="tile tile-compact">
            <p className="eyebrow">{split.name}</p>
            <p className="subhead mt-1 text-[var(--muted)]">{split.description}</p>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="stack-section space-y-5" aria-label="Objetivo">
          <div>
            <p className="mb-2 px-1 text-[13px] font-semibold text-[var(--muted)]">Objetivo</p>
            <SegmentedControl label="Objetivo" value={goal} onChange={setGoal} options={TRAINING_GOALS} />
          </div>
          <div>
            <p className="mb-2 px-1 text-[13px] font-semibold text-[var(--muted)]">Experiência</p>
            <SegmentedControl label="Experiência" value={experience} onChange={setExperience} options={EXPERIENCE_OPTIONS} />
          </div>
          <p className="footnote px-1 text-[var(--muted)]">
            {goal === 'forca' ? 'Básicos pesados (3-6 reps) com descanso longo e acessórios moderados.'
              : goal === 'condicionamento' ? 'Mais repetições (12-20) e descansos curtos para manter o ritmo.'
                : 'Faixas de 6-10 nos básicos e 10-15 nos isoladores, com progressão dupla.'}
          </p>
        </section>
      )}

      {step === 2 && (
        <section className="stack-section space-y-5" aria-label="Sessão">
          <div>
            <p className="mb-2 px-1 text-[13px] font-semibold text-[var(--muted)]">Duração da sessão</p>
            <SegmentedControl label="Duração da sessão" value={minutes} onChange={setMinutes} options={LENGTH_OPTIONS} />
          </div>
          <fieldset>
            <legend className="mb-2 px-1 text-[13px] font-semibold text-[var(--muted)]">Equipamentos disponíveis</legend>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_OPTIONS.map((item) => (
                <button key={item.value} type="button" className="chip" aria-pressed={selectedEquipment.includes(item.value)} onClick={() => toggleEquipment(item.value)}>
                  {selectedEquipment.includes(item.value) && <Check size={13} strokeWidth={3} aria-hidden />}{item.label}
                </button>
              ))}
            </div>
            <p className="footnote mt-2 px-1 text-[var(--muted)]">Exercícios com peso corporal sempre entram como opção.</p>
          </fieldset>
        </section>
      )}

      {step === 3 && plan && (
        <section className="stack-section space-y-4" aria-label="Revisar rotina">
          <div className="tile tile-compact">
            <p className="eyebrow">{plan.splitName}</p>
            <p className="subhead mt-1 text-[var(--muted)]">{plan.description} Ajuste nomes, dias, séries e exercícios antes de salvar.</p>
          </div>
          {plan.days.map((day) => (
            <DayEditor key={day.key} day={day} onChange={(updater) => updateDay(day.key, updater)} />
          ))}
          {error && <p role="alert" className="footnote px-1 text-[var(--danger)]">{error}</p>}
          <Button size="lg" className="w-full" disabled={saving || totalExercises === 0} onClick={() => void save()}>
            {saving ? 'Salvando...' : `Salvar ${plan.days.filter((day) => day.exercises.length > 0).length} rotinas`}
          </Button>
          <Button variant="secondary" size="lg" className="w-full" onClick={generate}><RefreshCw size={16} aria-hidden />Gerar de novo</Button>
        </section>
      )}

      <div className="mt-8 flex gap-3">
        {step > 0 && <Button variant="secondary" className="flex-1" onClick={() => setStep(step - 1)}>Voltar</Button>}
        {step < 2 && <Button className="flex-1" onClick={() => setStep(step + 1)}>Continuar</Button>}
        {step === 2 && <Button className="flex-1" disabled={selectedEquipment.length === 0} onClick={generate}>Gerar rotina</Button>}
      </div>
    </div>
  )
}

function DayEditor({ day, onChange }: { day: GeneratedDay; onChange: (updater: (day: GeneratedDay) => GeneratedDay) => void }) {
  const used = new Set(day.exercises.map((item) => normalizeExerciseName(item.candidate.name)))

  function updateExercise(index: number, updates: Partial<GeneratedDay['exercises'][number]>) {
    onChange((current) => ({ ...current, exercises: current.exercises.map((item, itemIndex) => (itemIndex === index ? { ...item, ...updates } : item)) }))
  }

  function swap(index: number) {
    const item = day.exercises[index]
    const options = item.options.filter((option) => option.name === item.candidate.name || !used.has(normalizeExerciseName(option.name)))
    if (options.length < 2) return
    const position = options.findIndex((option) => option.name === item.candidate.name)
    updateExercise(index, { candidate: options[(position + 1) % options.length] })
  }

  return (
    <div className="tile !p-0">
      <div className="flex items-center gap-3 px-5 pt-4">
        <span aria-hidden className="h-8 w-1.5 flex-none rounded-full" style={{ background: day.color }} />
        <label className="min-w-0 flex-1">
          <span className="sr-only">Nome do treino</span>
          <input value={day.name} onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))} className="title-3 w-full bg-transparent outline-none" />
        </label>
        <span className="footnote numeric flex-none text-[var(--muted)]">~{estimateDayMinutes(day)} min</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5 px-5 pt-3" role="group" aria-label={`Dias de ${day.name}`}>
        {WEEKDAYS.map((label, index) => (
          <button
            key={index}
            type="button"
            aria-pressed={day.weekdays.includes(index)}
            aria-label={WEEKDAY_NAMES[index]}
            onClick={() => onChange((current) => ({ ...current, weekdays: current.weekdays.includes(index) ? current.weekdays.filter((item) => item !== index) : [...current.weekdays, index] }))}
            className={`h-9 rounded-full text-[14px] font-semibold transition-colors ${day.weekdays.includes(index) ? 'bg-[var(--foreground)] text-[var(--background-elevated)]' : 'bg-[var(--fill-strong)]'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <ul className="mt-3 border-t border-[var(--separator)]">
        {day.exercises.map((item, index) => (
          <li key={`${item.candidate.name}-${index}`} className="grouped-row px-5 py-3">
            <div className="flex items-start gap-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate">{item.candidate.name}</span>
                <span className="footnote block text-[var(--muted)]">
                  {item.candidate.muscleGroup} · {EQUIPMENT_LABEL[item.candidate.equipment]}{item.candidate.id ? ' · já cadastrado' : ''}
                </span>
              </span>
              <button type="button" onClick={() => swap(index)} disabled={item.options.length < 2} className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[var(--accent)] disabled:opacity-30" aria-label={`Trocar ${item.candidate.name}`}>
                <Shuffle size={16} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => onChange((current) => ({ ...current, exercises: current.exercises.filter((_, itemIndex) => itemIndex !== index) }))}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[var(--danger)]"
                aria-label={`Remover ${item.candidate.name}`}
              >
                <Trash2 size={16} aria-hidden />
              </button>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {([
                ['Séries', item.sets, (value: number) => updateExercise(index, { sets: Math.max(1, Math.min(10, value)) })],
                ['Mín.', item.minReps, (value: number) => updateExercise(index, { minReps: Math.max(1, value) })],
                ['Máx.', item.maxReps, (value: number) => updateExercise(index, { maxReps: Math.max(1, value) })],
                ['Desc. (s)', item.restSeconds, (value: number) => updateExercise(index, { restSeconds: Math.max(0, Math.min(600, value)) })],
              ] as const).map(([label, value, onValue]) => (
                <label key={label} className="block">
                  <span className="caption mb-1 block text-center text-[var(--muted)]">{label}</span>
                  <DecimalInput integer value={value} onValueChange={onValue} className="set-field" aria-label={`${label} de ${item.candidate.name}`} />
                </label>
              ))}
            </div>
            <p className="caption mt-1.5 text-[var(--muted)]">
              Progressão dupla: ao fechar {item.maxReps} reps em todas as séries, suba {item.progression.increment} kg.
            </p>
          </li>
        ))}
        {day.exercises.length === 0 && <li className="subhead px-5 py-6 text-center text-[var(--muted)]">Sem exercícios. Este treino não será salvo.</li>}
      </ul>
    </div>
  )
}
