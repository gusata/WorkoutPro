/**
 * Exercise candidates for the routine generator.
 *
 * SWAP POINT: `INTERNAL_CANDIDATES` is a small built-in list. When the exercise
 * catalog (lib/exerciseLibrary.ts) lands, replace `catalogCandidates()` below with a
 * mapping from the library entries to `ExerciseCandidate` — nothing else in the
 * generator needs to change. `pattern` is optional: candidates without it are matched
 * by muscle group + mechanic.
 */
import type { Exercise, MuscleGroup } from '@/types'
import { WORKOUT_TEMPLATES } from '@/lib/workoutTemplates'
import { classifyExercise } from '@/lib/training'

export type EquipmentKind = 'barra' | 'halteres' | 'maquina' | 'cabo' | 'peso-corporal' | 'kettlebell' | 'elastico'
export type Mechanic = 'compound' | 'isolation'
export type MovementPattern =
  | 'squat' | 'hinge' | 'lunge' | 'knee-extension' | 'knee-flexion' | 'glute' | 'calf'
  | 'horizontal-push' | 'incline-push' | 'chest-fly' | 'vertical-push' | 'lateral-raise' | 'rear-delt'
  | 'horizontal-pull' | 'vertical-pull' | 'biceps' | 'triceps' | 'core'

export interface ExerciseCandidate {
  /** Set when the candidate is an exercise the user already has. */
  id?: string
  name: string
  muscleGroup: MuscleGroup
  equipment: EquipmentKind
  mechanic: Mechanic
  pattern?: MovementPattern
}

export const EQUIPMENT_OPTIONS: Array<{ value: EquipmentKind; label: string }> = [
  { value: 'barra', label: 'Barra e anilhas' },
  { value: 'halteres', label: 'Halteres' },
  { value: 'maquina', label: 'Máquinas' },
  { value: 'cabo', label: 'Polia / cabos' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'elastico', label: 'Elásticos' },
  { value: 'peso-corporal', label: 'Peso corporal' },
]

export const EQUIPMENT_LABEL: Record<EquipmentKind, string> = Object.fromEntries(
  EQUIPMENT_OPTIONS.map((item) => [item.value, item.label])
) as Record<EquipmentKind, string>

/** Value stored in Exercise.equipment for exercises the generator creates. */
export const EQUIPMENT_SHORT: Record<EquipmentKind, string> = {
  barra: 'Barra', halteres: 'Halteres', maquina: 'Máquina', cabo: 'Polia', 'peso-corporal': 'Peso corporal',
  kettlebell: 'Kettlebell', elastico: 'Elástico',
}

const PROFILE_EQUIPMENT: Record<string, EquipmentKind> = {
  barra: 'barra', halteres: 'halteres', maquinas: 'maquina', cabos: 'cabo', 'peso corporal': 'peso-corporal', elasticos: 'elastico', kettlebell: 'kettlebell',
}

/** Maps the labels saved in profile.availableEquipment (settings) to equipment kinds. */
export function equipmentFromProfile(labels: string[] | undefined): EquipmentKind[] {
  const kinds = (labels ?? []).map((label) => PROFILE_EQUIPMENT[normalizeExerciseName(label)]).filter((kind): kind is EquipmentKind => Boolean(kind))
  return kinds.length ? [...new Set(kinds)] : ['barra', 'halteres', 'maquina', 'cabo', 'peso-corporal']
}

export function normalizeExerciseName(name: string) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

type Row = [name: string, muscleGroup: MuscleGroup, equipment: EquipmentKind, mechanic: Mechanic, pattern: MovementPattern]

// Order inside a pattern = preference order (first = default pick, next = variation).
const INTERNAL_ROWS: Row[] = [
  ['Agachamento', 'Quadríceps', 'barra', 'compound', 'squat'],
  ['Leg Press', 'Quadríceps', 'maquina', 'compound', 'squat'],
  ['Agachamento Goblet', 'Quadríceps', 'halteres', 'compound', 'squat'],
  ['Agachamento no Smith', 'Quadríceps', 'maquina', 'compound', 'squat'],
  ['Agachamento Livre', 'Quadríceps', 'peso-corporal', 'compound', 'squat'],
  ['Levantamento Terra', 'Posterior', 'barra', 'compound', 'hinge'],
  ['Stiff', 'Posterior', 'barra', 'compound', 'hinge'],
  ['Stiff com Halteres', 'Posterior', 'halteres', 'compound', 'hinge'],
  ['Kettlebell Swing', 'Posterior', 'kettlebell', 'compound', 'hinge'],
  ['Ponte de Glúteo', 'Glúteo', 'peso-corporal', 'compound', 'hinge'],
  ['Afundo com Halteres', 'Quadríceps', 'halteres', 'compound', 'lunge'],
  ['Agachamento Búlgaro', 'Quadríceps', 'halteres', 'compound', 'lunge'],
  ['Afundo', 'Quadríceps', 'peso-corporal', 'compound', 'lunge'],
  ['Cadeira Extensora', 'Quadríceps', 'maquina', 'isolation', 'knee-extension'],
  ['Mesa Flexora', 'Posterior', 'maquina', 'isolation', 'knee-flexion'],
  ['Cadeira Flexora', 'Posterior', 'maquina', 'isolation', 'knee-flexion'],
  ['Flexora com Elástico', 'Posterior', 'elastico', 'isolation', 'knee-flexion'],
  ['Hip Thrust', 'Glúteo', 'barra', 'compound', 'glute'],
  ['Elevacao de Panturrilha', 'Panturrilha', 'maquina', 'isolation', 'calf'],
  ['Panturrilha com Halteres', 'Panturrilha', 'halteres', 'isolation', 'calf'],
  ['Panturrilha Unilateral', 'Panturrilha', 'peso-corporal', 'isolation', 'calf'],
  ['Supino Reto', 'Peitoral', 'barra', 'compound', 'horizontal-push'],
  ['Supino com Halteres', 'Peitoral', 'halteres', 'compound', 'horizontal-push'],
  ['Supino na Máquina', 'Peitoral', 'maquina', 'compound', 'horizontal-push'],
  ['Flexão de Braço', 'Peitoral', 'peso-corporal', 'compound', 'horizontal-push'],
  ['Supino Inclinado', 'Peitoral', 'barra', 'compound', 'incline-push'],
  ['Supino Inclinado com Halteres', 'Peitoral', 'halteres', 'compound', 'incline-push'],
  ['Flexão Declinada', 'Peitoral', 'peso-corporal', 'compound', 'incline-push'],
  ['Crucifixo com Halteres', 'Peitoral', 'halteres', 'isolation', 'chest-fly'],
  ['Crossover', 'Peitoral', 'cabo', 'isolation', 'chest-fly'],
  ['Peck Deck', 'Peitoral', 'maquina', 'isolation', 'chest-fly'],
  ['Desenvolvimento', 'Ombros', 'barra', 'compound', 'vertical-push'],
  ['Desenvolvimento com Halteres', 'Ombros', 'halteres', 'compound', 'vertical-push'],
  ['Desenvolvimento na Máquina', 'Ombros', 'maquina', 'compound', 'vertical-push'],
  ['Flexão Pike', 'Ombros', 'peso-corporal', 'compound', 'vertical-push'],
  ['Elevacao Lateral', 'Ombros', 'halteres', 'isolation', 'lateral-raise'],
  ['Elevação Lateral no Cabo', 'Ombros', 'cabo', 'isolation', 'lateral-raise'],
  ['Elevação Lateral com Elástico', 'Ombros', 'elastico', 'isolation', 'lateral-raise'],
  ['Face Pull', 'Ombros', 'cabo', 'isolation', 'rear-delt'],
  ['Crucifixo Inverso', 'Ombros', 'halteres', 'isolation', 'rear-delt'],
  ['Face Pull com Elástico', 'Ombros', 'elastico', 'isolation', 'rear-delt'],
  ['Remada Curvada', 'Costas', 'barra', 'compound', 'horizontal-pull'],
  ['Remada Baixa', 'Costas', 'cabo', 'compound', 'horizontal-pull'],
  ['Remada Unilateral com Halter', 'Costas', 'halteres', 'compound', 'horizontal-pull'],
  ['Remada na Máquina', 'Costas', 'maquina', 'compound', 'horizontal-pull'],
  ['Remada com Elástico', 'Costas', 'elastico', 'compound', 'horizontal-pull'],
  ['Remada Invertida', 'Costas', 'peso-corporal', 'compound', 'horizontal-pull'],
  ['Puxada Frontal', 'Costas', 'cabo', 'compound', 'vertical-pull'],
  ['Barra Fixa', 'Costas', 'peso-corporal', 'compound', 'vertical-pull'],
  ['Pulldown com Elástico', 'Costas', 'elastico', 'compound', 'vertical-pull'],
  ['Rosca Direta', 'Bíceps', 'barra', 'isolation', 'biceps'],
  ['Rosca Alternada', 'Bíceps', 'halteres', 'isolation', 'biceps'],
  ['Rosca Martelo', 'Bíceps', 'halteres', 'isolation', 'biceps'],
  ['Rosca no Cabo', 'Bíceps', 'cabo', 'isolation', 'biceps'],
  ['Rosca com Elástico', 'Bíceps', 'elastico', 'isolation', 'biceps'],
  ['Triceps Pulley', 'Tríceps', 'cabo', 'isolation', 'triceps'],
  ['Tríceps Testa', 'Tríceps', 'barra', 'isolation', 'triceps'],
  ['Tríceps Francês com Halter', 'Tríceps', 'halteres', 'isolation', 'triceps'],
  ['Mergulho no Banco', 'Tríceps', 'peso-corporal', 'compound', 'triceps'],
  ['Tríceps com Elástico', 'Tríceps', 'elastico', 'isolation', 'triceps'],
  ['Prancha', 'Abdômen', 'peso-corporal', 'isolation', 'core'],
  ['Abdominal na Polia', 'Abdômen', 'cabo', 'isolation', 'core'],
  ['Abdominal Supra', 'Abdômen', 'peso-corporal', 'isolation', 'core'],
]

export const INTERNAL_CANDIDATES: ExerciseCandidate[] = INTERNAL_ROWS.map(([name, muscleGroup, equipment, mechanic, pattern]) => ({
  name, muscleGroup, equipment, mechanic, pattern,
}))

/** Replace this with a mapping from lib/exerciseLibrary.ts when it is available. */
function catalogCandidates(): ExerciseCandidate[] {
  return INTERNAL_CANDIDATES
}

const EQUIPMENT_WORDS: Array<[EquipmentKind, string[]]> = [
  ['halteres', ['halter', 'dumbbell']],
  ['kettlebell', ['kettlebell']],
  ['elastico', ['elastico', 'band']],
  ['cabo', ['cabo', 'polia', 'pulley', 'crossover', 'cable']],
  ['maquina', ['maquina', 'smith', 'leg press', 'hack', 'extensora', 'flexora', 'peck deck', 'voador']],
  ['peso-corporal', ['peso corporal', 'flexao', 'barra fixa', 'prancha', 'mergulho', 'abdominal']],
  ['barra', ['barra']],
]

function guessEquipment(name: string, equipment?: string): EquipmentKind {
  const text = normalizeExerciseName(`${equipment ?? ''} ${name}`)
  for (const [kind, words] of EQUIPMENT_WORDS) if (words.some((word) => text.includes(word))) return kind
  return classifyExercise(name, equipment).barbell ? 'barra' : 'maquina'
}

/** A user's existing exercise as a candidate (matched to a catalog entry by name when possible). */
function fromUserExercise(exercise: Exercise, byName: Map<string, ExerciseCandidate>): ExerciseCandidate {
  const known = byName.get(normalizeExerciseName(exercise.name))
  if (known) return { ...known, id: exercise.id, name: exercise.name, muscleGroup: exercise.muscleGroup }
  return {
    id: exercise.id,
    name: exercise.name,
    muscleGroup: exercise.muscleGroup,
    equipment: guessEquipment(exercise.name, exercise.equipment),
    mechanic: classifyExercise(exercise.name, exercise.equipment).isolation ? 'isolation' : 'compound',
  }
}

/**
 * All candidates, deduplicated by normalized name. Existing user exercises win (they
 * carry their id), template exercises come next, then the catalog.
 */
export function getExerciseCandidates(userExercises: Exercise[] = []): ExerciseCandidate[] {
  const catalog = catalogCandidates()
  const byName = new Map(catalog.map((item) => [normalizeExerciseName(item.name), item]))
  const result = new Map<string, ExerciseCandidate>()
  for (const exercise of userExercises) {
    const key = normalizeExerciseName(exercise.name)
    if (!result.has(key)) result.set(key, fromUserExercise(exercise, byName))
  }
  for (const template of WORKOUT_TEMPLATES) {
    for (const item of template.exercises) {
      const key = normalizeExerciseName(item.name)
      if (result.has(key)) continue
      const known = byName.get(key)
      result.set(key, known ?? {
        name: item.name, muscleGroup: item.muscleGroup,
        equipment: guessEquipment(item.name), mechanic: classifyExercise(item.name).isolation ? 'isolation' : 'compound',
      })
    }
  }
  for (const item of catalog) {
    const key = normalizeExerciseName(item.name)
    if (!result.has(key)) result.set(key, item)
  }
  return [...result.values()]
}
