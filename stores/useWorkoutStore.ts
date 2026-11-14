'use client'

import { create } from 'zustand'
import { db } from '@/lib/db'
import type { Workout, Exercise } from '@/types'
import { generateId } from '@/lib/utils'
import { queueSync } from '@/lib/syncQueue'
import { findUserExerciseForLibrary, getLibraryExercise, libraryExerciseToDraft } from '@/lib/exerciseLibrary'

interface WorkoutStore {
  workouts: Workout[]
  exercises: Exercise[]
  loaded: boolean
  load: () => Promise<void>
  addWorkout: (w: Omit<Workout, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>
  updateWorkout: (id: string, updates: Partial<Workout>) => Promise<void>
  deleteWorkout: (id: string) => Promise<void>
  addExercise: (e: Omit<Exercise, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>
  updateExercise: (id: string, updates: Partial<Exercise>) => Promise<void>
  /** Adds a library exercise to the user's exercises, reusing (and linking) an existing one instead of duplicating. */
  addLibraryExercise: (libraryId: string) => Promise<string>
  deleteExercise: (id: string) => Promise<void>
  addExerciseToWorkout: (workoutId: string, exerciseId: string) => Promise<void>
  removeExerciseFromWorkout: (workoutId: string, exerciseId: string) => Promise<void>
  reorderExercises: (workoutId: string, newExerciseIds: string[]) => Promise<void>
}

export const useWorkoutStore = create<WorkoutStore>((set, get) => ({
  workouts: [],
  exercises: [],
  loaded: false,

  load: async () => {
    const [workouts, exercises] = await Promise.all([
      db.workouts.orderBy('createdAt').toArray(),
      db.exercises.orderBy('createdAt').toArray(),
    ])
    set({ workouts, exercises, loaded: true })
  },

  addWorkout: async (data) => {
    const now = new Date()
    const workout: Workout = {
      id: generateId(),
      ...data,
      exerciseIds: data.exerciseIds ?? [],
      createdAt: now,
      updatedAt: now,
    }
    await db.transaction('rw', [db.workouts, db.syncQueue], async () => {
      await db.workouts.add(workout)
      await queueSync('workouts', workout.id)
    })
    set((s) => ({ workouts: [...s.workouts, workout] }))
    return workout.id
  },

  updateWorkout: async (id, updates) => {
    const updatedAt = new Date()
    await db.transaction('rw', [db.workouts, db.syncQueue], async () => {
      await db.workouts.update(id, { ...updates, updatedAt })
      await queueSync('workouts', id)
    })
    set((s) => ({
      workouts: s.workouts.map((w) =>
        w.id === id ? { ...w, ...updates, updatedAt } : w
      ),
    }))
  },

  deleteWorkout: async (id) => {
    await db.transaction('rw', [db.workouts, db.syncQueue], async () => {
      await db.workouts.delete(id)
      await queueSync('workouts', id, 'delete')
    })
    set((s) => ({ workouts: s.workouts.filter((w) => w.id !== id) }))
  },

  addExercise: async (data) => {
    const now = new Date()
    const exercise: Exercise = {
      id: generateId(),
      ...data,
      createdAt: now,
      updatedAt: now,
    }
    await db.transaction('rw', [db.exercises, db.syncQueue], async () => {
      await db.exercises.add(exercise)
      await queueSync('exercises', exercise.id)
    })
    set((s) => ({ exercises: [...s.exercises, exercise] }))
    return exercise.id
  },

  updateExercise: async (id, updates) => {
    const updatedAt = new Date()
    await db.transaction('rw', [db.exercises, db.syncQueue], async () => {
      await db.exercises.update(id, { ...updates, updatedAt })
      await queueSync('exercises', id)
    })
    set((s) => ({
      exercises: s.exercises.map((e) => (e.id === id ? { ...e, ...updates, updatedAt } : e)),
    }))
  },

  addLibraryExercise: async (libraryId) => {
    const item = getLibraryExercise(libraryId)
    if (!item) throw new Error(`Exercício da biblioteca desconhecido: ${libraryId}`)
    const existing = findUserExerciseForLibrary(get().exercises, item)
    if (existing) {
      if (existing.libraryId !== item.id) await get().updateExercise(existing.id, { libraryId: item.id })
      return existing.id
    }
    return get().addExercise(libraryExerciseToDraft(item))
  },

  deleteExercise: async (id) => {
    const affected = get().workouts.filter((workout) => workout.exerciseIds.includes(id))
    const updatedAt = new Date()
    await db.transaction('rw', [db.exercises, db.workouts, db.syncQueue], async () => {
      await db.exercises.delete(id)
      await queueSync('exercises', id, 'delete')
      for (const workout of affected) {
        await db.workouts.update(workout.id, {
          exerciseIds: workout.exerciseIds.filter((exerciseId) => exerciseId !== id),
          updatedAt,
        })
        await queueSync('workouts', workout.id)
      }
    })
    set((s) => ({
      exercises: s.exercises.filter((exercise) => exercise.id !== id),
      workouts: s.workouts.map((workout) =>
        workout.exerciseIds.includes(id)
          ? { ...workout, exerciseIds: workout.exerciseIds.filter((exerciseId) => exerciseId !== id), updatedAt }
          : workout
      ),
    }))
  },

  addExerciseToWorkout: async (workoutId, exerciseId) => {
    const workout = get().workouts.find((w) => w.id === workoutId)
    if (!workout) return
    if (workout.exerciseIds.includes(exerciseId)) return
    const updatedAt = new Date()
    const exerciseIds = [...workout.exerciseIds, exerciseId]
    await db.transaction('rw', [db.workouts, db.syncQueue], async () => {
      await db.workouts.update(workoutId, { exerciseIds, updatedAt })
      await queueSync('workouts', workoutId)
    })
    set((s) => ({
      workouts: s.workouts.map((w) =>
        w.id === workoutId ? { ...w, exerciseIds, updatedAt } : w
      ),
    }))
  },

  removeExerciseFromWorkout: async (workoutId, exerciseId) => {
    const workout = get().workouts.find((w) => w.id === workoutId)
    if (!workout) return
    const updatedAt = new Date()
    const exerciseIds = workout.exerciseIds.filter((id) => id !== exerciseId)
    await db.transaction('rw', [db.workouts, db.syncQueue], async () => {
      await db.workouts.update(workoutId, { exerciseIds, updatedAt })
      await queueSync('workouts', workoutId)
    })
    set((s) => ({
      workouts: s.workouts.map((w) =>
        w.id === workoutId ? { ...w, exerciseIds, updatedAt } : w
      ),
    }))
  },

  reorderExercises: async (workoutId, newExerciseIds) => {
    const updatedAt = new Date()
    // Optimistic update first so Reorder.Group sees the new values immediately
    set((s) => ({
      workouts: s.workouts.map((w) =>
        w.id === workoutId ? { ...w, exerciseIds: newExerciseIds, updatedAt } : w
      ),
    }))
    try {
      await db.transaction('rw', [db.workouts, db.syncQueue], async () => {
        await db.workouts.update(workoutId, { exerciseIds: newExerciseIds, updatedAt })
        await queueSync('workouts', workoutId)
      })
    } catch (error) {
      await get().load()
      throw error
    }
  },
}))
