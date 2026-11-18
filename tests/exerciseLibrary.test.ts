import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearLocalData, db, initProfile } from '@/lib/db'
import { exportData, parseBackup } from '@/lib/backup'
import { EXERCISE_SEEDS } from '@/lib/seed'
import { MUSCLE_GROUPS } from '@/lib/utils'
import { WORKOUT_TEMPLATES } from '@/lib/workoutTemplates'
import {
  EQUIPMENT_LABELS,
  findLibraryMatch,
  findUserExerciseForLibrary,
  getLibraryExercise,
  LIBRARY,
  libraryExerciseToDraft,
  libraryImageUrls,
  normalizeSearchText,
  searchLibrary,
} from '@/lib/exerciseLibrary'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { makeExercise } from './fixtures'

describe('catalogo da biblioteca', () => {
  it('tem entre 150 e 200 exercicios com ids unicos e estaveis', () => {
    expect(LIBRARY.length).toBeGreaterThanOrEqual(150)
    expect(LIBRARY.length).toBeLessThanOrEqual(200)
    const ids = LIBRARY.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('usa apenas grupos musculares e equipamentos validos', () => {
    for (const item of LIBRARY) {
      expect(MUSCLE_GROUPS, item.id).toContain(item.muscleGroup)
      for (const muscle of item.secondaryMuscles) expect(MUSCLE_GROUPS, item.id).toContain(muscle)
      expect(item.secondaryMuscles, item.id).not.toContain(item.muscleGroup)
      expect(Object.keys(EQUIPMENT_LABELS), item.id).toContain(item.equipment)
      expect(['composto', 'isolado']).toContain(item.mechanic)
      expect(['iniciante', 'intermediario', 'avancado']).toContain(item.level)
    }
  })

  it('cada exercicio tem 3 a 5 passos e 1 a 2 erros comuns preenchidos', () => {
    for (const item of LIBRARY) {
      expect(item.name.trim(), item.id).not.toBe('')
      expect(item.englishName.trim(), item.id).not.toBe('')
      expect(item.instructions.length, item.id).toBeGreaterThanOrEqual(3)
      expect(item.instructions.length, item.id).toBeLessThanOrEqual(5)
      expect(item.mistakes.length, item.id).toBeGreaterThanOrEqual(1)
      expect(item.mistakes.length, item.id).toBeLessThanOrEqual(2)
      for (const text of [...item.instructions, ...item.mistakes]) expect(text.trim().length, item.id).toBeGreaterThan(5)
    }
  })

  it('nomes e apelidos nao colidem entre exercicios (match por nome e confiavel)', () => {
    const owner = new Map<string, string>()
    for (const item of LIBRARY) {
      for (const label of [item.name, ...item.aliases]) {
        const key = normalizeSearchText(label)
        const previous = owner.get(key)
        if (previous) expect(previous, `"${label}" em ${item.id}`).toBe(item.id)
        owner.set(key, item.id)
      }
    }
  })

  it('cobre todos os grupos musculares e equipamentos', () => {
    for (const muscle of MUSCLE_GROUPS) expect(LIBRARY.some((item) => item.muscleGroup === muscle), muscle).toBe(true)
    for (const equipment of Object.keys(EQUIPMENT_LABELS)) expect(LIBRARY.some((item) => item.equipment === equipment), equipment).toBe(true)
  })

  it('monta URLs fixadas em um commit do free-exercise-db', () => {
    const urls = libraryImageUrls(getLibraryExercise('supino-reto-barra')!)
    expect(urls).toEqual([
      'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg',
      'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/Barbell_Bench_Press_-_Medium_Grip/1.jpg',
    ])
    expect(libraryImageUrls(getLibraryExercise('barra-fixa-assistida')!)).toBeNull()
    for (const item of LIBRARY) if (item.imageId) expect(item.imageId, item.id).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('getLibraryExercise devolve undefined para ids desconhecidos', () => {
    expect(getLibraryExercise('nao-existe')).toBeUndefined()
    expect(getLibraryExercise(undefined)).toBeUndefined()
    expect(getLibraryExercise('cadeira-extensora')?.name).toBe('Cadeira extensora')
  })
})

describe('busca e filtros', () => {
  it('normaliza acentos, caixa e pontuacao', () => {
    expect(normalizeSearchText('  Elevação  Pélvica! ')).toBe('elevacao pelvica')
    expect(normalizeSearchText('Leg press 45°')).toBe('leg press 45')
  })

  it('ignora acentos e prioriza o nome', () => {
    expect(searchLibrary('elevacao lateral')[0].id).toBe('elevacao-lateral')
    expect(searchLibrary('TRÍCEPS CORDA')[0].id).toBe('triceps-corda')
    expect(searchLibrary('supino reto')[0].id).toBe('supino-reto-barra')
  })

  it('encontra por apelido e nome em ingles', () => {
    expect(searchLibrary('voador').map((item) => item.id)).toContain('crucifixo-maquina')
    expect(searchLibrary('serrote')[0].id).toBe('remada-unilateral-halter')
    expect(searchLibrary('elevacao pelvica').map((item) => item.id)).toContain('hip-thrust')
    expect(searchLibrary('lat pulldown').map((item) => item.id)).toContain('puxada-frontal')
    expect(searchLibrary('romanian deadlift')[0].id).toBe('terra-romeno')
  })

  it('encontra por sinonimo de grupo muscular', () => {
    const results = searchLibrary('peito')
    const chest = LIBRARY.filter((item) => item.muscleGroup === 'Peitoral')
    expect(chest.every((item) => results.includes(item))).toBe(true)
    // Only other hit: an alias that literally says "peito" ("Arranque ao peito").
    expect(results.filter((item) => item.muscleGroup !== 'Peitoral').map((item) => item.id)).toEqual(['arremesso'])
  })

  it('exige todos os termos da busca', () => {
    expect(searchLibrary('supino xyzinexistente')).toEqual([])
  })

  it('filtra por grupo muscular e equipamento', () => {
    const quadsMachine = searchLibrary('', { muscleGroup: 'Quadríceps', equipment: 'maquina' })
    expect(quadsMachine.length).toBeGreaterThan(0)
    expect(quadsMachine.every((item) => item.muscleGroup === 'Quadríceps' && item.equipment === 'maquina')).toBe(true)
    expect(quadsMachine.map((item) => item.id)).toContain('cadeira-extensora')

    const supinoSmith = searchLibrary('supino', { equipment: 'smith' })
    expect(supinoSmith.map((item) => item.id).sort()).toEqual(['supino-inclinado-smith', 'supino-reto-smith'])
  })

  it('inclui musculos secundarios apenas quando pedido', () => {
    const primary = searchLibrary('', { muscleGroup: 'Tríceps' })
    const withSecondary = searchLibrary('', { muscleGroup: 'Tríceps', includeSecondary: true })
    expect(primary.map((item) => item.id)).not.toContain('supino-reto-barra')
    expect(withSecondary.map((item) => item.id)).toContain('supino-reto-barra')
  })

  it('sem busca nem filtros devolve o catalogo inteiro', () => {
    expect(searchLibrary('')).toHaveLength(LIBRARY.length)
  })
})

describe('vinculo com exercicios do usuario', () => {
  it('reconhece com confianca nomes antigos, dos modelos e da demo', () => {
    expect(findLibraryMatch({ name: 'Supino Reto' })?.id).toBe('supino-reto-barra')
    expect(findLibraryMatch({ name: 'Triceps Pulley' })?.id).toBe('triceps-pulley')
    expect(findLibraryMatch({ name: 'Elevacao de Panturrilha' })?.id).toBe('panturrilha-em-pe')
    expect(findLibraryMatch({ name: 'Meu exercicio inventado' })).toBeUndefined()
    for (const template of WORKOUT_TEMPLATES) {
      for (const item of template.exercises) expect(findLibraryMatch({ name: item.name }), item.name).toBeDefined()
    }
  })

  it('prefere o libraryId ao nome', () => {
    expect(findLibraryMatch({ name: 'Supino Reto', libraryId: 'supino-reto-smith' })?.id).toBe('supino-reto-smith')
    expect(findLibraryMatch({ name: 'Supino Reto', libraryId: 'id-removido' })).toBeUndefined()
  })

  it('os ids da demo apontam para exercicios existentes', () => {
    for (const seed of EXERCISE_SEEDS) {
      const item = getLibraryExercise(seed.libraryId)
      expect(item, seed.id).toBeDefined()
      expect(item?.muscleGroup, seed.id).toBe(seed.muscleGroup)
    }
  })

  it('encontra exercicio do usuario por id e por nome sem vinculo', () => {
    const item = getLibraryExercise('supino-reto-barra')!
    const linked = makeExercise({ id: 'a', name: 'Meu supino', libraryId: 'supino-reto-barra' })
    const legacy = makeExercise({ id: 'b', name: 'supino reto' })
    const other = makeExercise({ id: 'c', name: 'Supino reto', libraryId: 'supino-reto-smith' })
    expect(findUserExerciseForLibrary([legacy, linked], item)?.id).toBe('a')
    expect(findUserExerciseForLibrary([legacy], item)?.id).toBe('b')
    expect(findUserExerciseForLibrary([other], item)).toBeUndefined()
  })

  it('cria o rascunho com equipamento, notas e vinculo', () => {
    const draft = libraryExerciseToDraft(getLibraryExercise('cadeira-extensora')!)
    expect(draft).toMatchObject({ name: 'Cadeira extensora', muscleGroup: 'Quadríceps', equipment: 'Máquina', libraryId: 'cadeira-extensora' })
    expect(draft.notes).toMatch(/^Evite: /)
    expect(draft.alternatives?.length).toBeGreaterThan(0)
    expect(draft.alternatives).not.toContain('Cadeira extensora')
  })
})

describe('adicionar da biblioteca (store)', () => {
  beforeEach(async () => {
    await clearLocalData()
    useWorkoutStore.setState({ exercises: [], workouts: [], loaded: true })
  })

  it('cria o exercicio vinculado e enfileira a sincronizacao', async () => {
    const id = await useWorkoutStore.getState().addLibraryExercise('hip-thrust')
    const saved = await db.exercises.get(id)
    expect(saved).toMatchObject({ name: 'Hip thrust com barra', muscleGroup: 'Glúteo', equipment: 'Barra', libraryId: 'hip-thrust' })
    expect(await db.syncQueue.count()).toBe(1)
  })

  it('nao duplica ao adicionar duas vezes', async () => {
    const first = await useWorkoutStore.getState().addLibraryExercise('hip-thrust')
    const second = await useWorkoutStore.getState().addLibraryExercise('hip-thrust')
    expect(second).toBe(first)
    expect(await db.exercises.count()).toBe(1)
  })

  it('reaproveita e vincula um exercicio antigo com o mesmo nome', async () => {
    const legacy = makeExercise({ id: 'legacy', name: 'Leg Press', muscleGroup: 'Quadríceps', notes: 'banco 3' })
    await db.exercises.add(legacy)
    useWorkoutStore.setState({ exercises: [legacy] })

    const id = await useWorkoutStore.getState().addLibraryExercise('leg-press-45')
    expect(id).toBe('legacy')
    expect(await db.exercises.count()).toBe(1)
    expect(await db.exercises.get('legacy')).toMatchObject({ libraryId: 'leg-press-45', notes: 'banco 3', name: 'Leg Press' })
  })

  it('rejeita ids desconhecidos', async () => {
    await expect(useWorkoutStore.getState().addLibraryExercise('nao-existe')).rejects.toThrow()
  })
})

describe('backup e nuvem com libraryId', () => {
  beforeEach(async () => {
    await clearLocalData()
    await initProfile()
  })

  it('preserva o libraryId no backup e aceita backups antigos sem ele', async () => {
    await db.exercises.bulkAdd([makeExercise({ libraryId: 'supino-reto-barra' }), makeExercise({ id: 'exercise-2', name: 'Sem vínculo' })])
    const parsed = parseBackup(JSON.parse(JSON.stringify(await exportData())))
    const byId = new Map(parsed.backup.data.exercises.map((item) => [item.id, item]))
    expect(byId.get('exercise-1')?.libraryId).toBe('supino-reto-barra')
    expect(byId.get('exercise-2')?.libraryId).toBeUndefined()
  })

  it('schema Supabase tem a coluna library_id anulavel com migracao', () => {
    const schema = readFileSync(resolve('supabase/schema.sql'), 'utf8').toLowerCase()
    expect(schema).toContain('alter table public.exercises add column if not exists library_id text;')
    expect(schema).not.toMatch(/library_id text not null/)
  })
})
