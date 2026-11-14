import type { Exercise, MuscleGroup } from '@/types'
import { LIBRARY_DATA } from '@/lib/exerciseLibraryData'

/**
 * Bundled exercise catalog (PT-BR names as used in Brazilian gyms).
 *
 * Public API for other features (e.g. a routine generator):
 * - `LIBRARY`: every entry, grouped by primary muscle group.
 * - `getLibraryExercise(id)`: lookup by stable id.
 * - `searchLibrary(query, filters)`: accent-insensitive search over name, aliases and English name.
 * - `findLibraryMatch(exercise)`: library entry linked to (or confidently matching) a user exercise.
 *
 * Ids are stable: never rename or reuse one, user exercises store them in `Exercise.libraryId`.
 */

export type LibraryEquipment = 'barra' | 'halteres' | 'maquina' | 'polia' | 'peso-corporal' | 'kettlebell' | 'elastico' | 'smith'
export type LibraryMechanic = 'composto' | 'isolado'
export type LibraryLevel = 'iniciante' | 'intermediario' | 'avancado'

export interface LibraryExercise {
  id: string
  name: string
  englishName: string
  /** Other names used in gyms; also used for confident name matching of legacy exercises. */
  aliases: string[]
  muscleGroup: MuscleGroup
  secondaryMuscles: MuscleGroup[]
  equipment: LibraryEquipment
  mechanic: LibraryMechanic
  level: LibraryLevel
  instructions: string[]
  mistakes: string[]
  /** Folder id in yuhonas/free-exercise-db (public domain), only when the movement is equivalent. */
  imageId: string | null
}

export interface LibraryFilters {
  muscleGroup?: MuscleGroup | null
  equipment?: LibraryEquipment | null
  mechanic?: LibraryMechanic | null
  level?: LibraryLevel | null
  /** Also match exercises where the muscle group is only secondary. */
  includeSecondary?: boolean
}

export const EQUIPMENT_LABELS: Record<LibraryEquipment, string> = {
  barra: 'Barra',
  halteres: 'Halteres',
  maquina: 'Máquina',
  polia: 'Polia',
  'peso-corporal': 'Peso corporal',
  kettlebell: 'Kettlebell',
  elastico: 'Elástico',
  smith: 'Smith',
}

export const LIBRARY_EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as LibraryEquipment[]

export const MECHANIC_LABELS: Record<LibraryMechanic, string> = { composto: 'Composto', isolado: 'Isolado' }
export const LEVEL_LABELS: Record<LibraryLevel, string> = { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' }

/** Pinned commit of yuhonas/free-exercise-db (Unlicense). Images are loaded on demand, never bundled. */
export const FREE_EXERCISE_DB_COMMIT = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5'
const IMAGE_BASE = `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${FREE_EXERCISE_DB_COMMIT}/exercises`

export const LIBRARY: readonly LibraryExercise[] = LIBRARY_DATA

const BY_ID = new Map(LIBRARY.map((item) => [item.id, item]))

/** Extra words that find an exercise by its muscle group ("peito", "coxa"...). */
const MUSCLE_SYNONYMS: Record<MuscleGroup, string> = {
  Peitoral: 'peitoral peito chest',
  Costas: 'costas dorsal dorsais back',
  Ombros: 'ombros ombro deltoide deltoides shoulders',
  'Bíceps': 'biceps',
  'Tríceps': 'triceps',
  'Antebraço': 'antebraco antebracos punho forearm',
  'Abdômen': 'abdomen abdominal abs core',
  'Quadríceps': 'quadriceps coxa perna pernas quads',
  Posterior: 'posterior isquiotibiais posterior de coxa hamstrings',
  'Glúteo': 'gluteo gluteos bumbum glutes',
  Panturrilha: 'panturrilha gemeos calves',
  'Trapézio': 'trapezio traps',
  Lombar: 'lombar lower back',
  'Full Body': 'full body corpo todo funcional',
}

export function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

interface SearchIndexEntry { item: LibraryExercise; name: string; aliases: string; all: string }

const INDEX: SearchIndexEntry[] = LIBRARY.map((item) => {
  const name = normalizeSearchText(item.name)
  const aliases = normalizeSearchText([...item.aliases, item.englishName].join(' '))
  const all = ` ${name} ${aliases} ${normalizeSearchText(EQUIPMENT_LABELS[item.equipment])} ${MUSCLE_SYNONYMS[item.muscleGroup]} `
  return { item, name, aliases, all }
})

export function getLibraryExercise(id: string | null | undefined): LibraryExercise | undefined {
  return id ? BY_ID.get(id) : undefined
}

export function matchesLibraryFilters(item: LibraryExercise, filters: LibraryFilters = {}) {
  if (filters.muscleGroup && item.muscleGroup !== filters.muscleGroup) {
    if (!filters.includeSecondary || !item.secondaryMuscles.includes(filters.muscleGroup)) return false
  }
  if (filters.equipment && item.equipment !== filters.equipment) return false
  if (filters.mechanic && item.mechanic !== filters.mechanic) return false
  if (filters.level && item.level !== filters.level) return false
  return true
}

/**
 * Accent- and case-insensitive search. Every query word must appear (as a word prefix or
 * substring) in the name, aliases, English name, equipment or muscle synonyms.
 * Results are ranked: name starts with query > name contains every word > alias hits.
 */
export function searchLibrary(query = '', filters: LibraryFilters = {}): LibraryExercise[] {
  const normalizedQuery = normalizeSearchText(query)
  const terms = normalizedQuery.split(' ').filter(Boolean)
  const candidates = INDEX.filter((entry) => matchesLibraryFilters(entry.item, filters))
  if (terms.length === 0) return candidates.map((entry) => entry.item)

  const scored: Array<{ item: LibraryExercise; score: number }> = []
  for (const entry of candidates) {
    if (!terms.every((term) => entry.all.includes(term))) continue
    let score = 3
    if (entry.name.startsWith(normalizedQuery)) score = 0
    else if (terms.every((term) => entry.name.includes(term))) score = 1
    else if (terms.every((term) => entry.aliases.includes(term) || entry.name.includes(term))) score = 2
    scored.push({ item: entry.item, score })
  }
  return scored
    .sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name, 'pt-BR'))
    .map((entry) => entry.item)
}

/** Exact (normalized) name or alias -> library id. Built once; aliases are unique across the catalog. */
const NAME_INDEX = new Map<string, LibraryExercise>()
for (const item of LIBRARY) {
  for (const label of [item.name, item.englishName, ...item.aliases]) {
    const key = normalizeSearchText(label)
    if (!NAME_INDEX.has(key)) NAME_INDEX.set(key, item)
  }
}

/** Library entry for a user exercise: its `libraryId`, or an exact name/alias match for legacy records. */
export function findLibraryMatch(exercise: Pick<Exercise, 'name'> & { libraryId?: string | null }): LibraryExercise | undefined {
  const linked = getLibraryExercise(exercise.libraryId)
  if (linked) return linked
  if (exercise.libraryId) return undefined
  return NAME_INDEX.get(normalizeSearchText(exercise.name))
}

/**
 * The user's exercise that already represents this library entry, so adding it again
 * reuses the record instead of duplicating it: linked by id first, then an unlinked
 * exercise with the same (normalized) name or alias.
 */
export function findUserExerciseForLibrary<T extends Pick<Exercise, 'id' | 'name'> & { libraryId?: string | null }>(exercises: T[], item: LibraryExercise): T | undefined {
  const linked = exercises.find((exercise) => exercise.libraryId === item.id)
  if (linked) return linked
  return exercises.find((exercise) => !exercise.libraryId && NAME_INDEX.get(normalizeSearchText(exercise.name))?.id === item.id)
}

/** Similar exercises (same primary muscle, then same mechanic) used as swap suggestions. */
export function suggestLibraryAlternatives(item: LibraryExercise, limit = 3): LibraryExercise[] {
  return LIBRARY
    .filter((other) => other.id !== item.id && other.muscleGroup === item.muscleGroup)
    .sort((a, b) => Number(b.mechanic === item.mechanic) - Number(a.mechanic === item.mechanic))
    .slice(0, limit)
}

/** Fields of a new user Exercise created from the library. */
export function libraryExerciseToDraft(item: LibraryExercise): Omit<Exercise, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: item.name,
    muscleGroup: item.muscleGroup,
    notes: item.mistakes.length ? `Evite: ${item.mistakes[0]}` : '',
    equipment: EQUIPMENT_LABELS[item.equipment],
    alternatives: suggestLibraryAlternatives(item).map((other) => other.name),
    libraryId: item.id,
  }
}

/** Start/end frame URLs on the pinned CDN, or null when no equivalent illustration exists. */
export function libraryImageUrls(item: Pick<LibraryExercise, 'imageId'>): [string, string] | null {
  if (!item.imageId) return null
  const folder = encodeURIComponent(item.imageId)
  return [`${IMAGE_BASE}/${folder}/0.jpg`, `${IMAGE_BASE}/${folder}/1.jpg`]
}
