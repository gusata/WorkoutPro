'use client'

import { create } from 'zustand'
import { db } from '@/lib/db'
import type { Workout, Exercise } from '@/types'
import { generateId } from '@/lib/utils'
import { queueSync } from '@/lib/syncQueue'

interface WorkoutStore {
  workouts: Workout[]
  exercises: Exercise[]
  loaded: boolean
  load: () => Promise<void>
  addWorkout: (w: Omit<Workout, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>
  updateWorkout: (id: string, updates: Partial<Workout>) => Promise<void>
  deleteWorkout: (id: string) => Promise<void>
  addExercise: (e: Omit<Exercise, 'id' | 'createdAt'>) => Promise<string>
  updateExercise: (id: string, updates: Partial<Exercise>) => Promise<void>
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
    const workout: Workout = {
      id: generateId(),
      ...data,
      exerciseIds: data.exerciseIds ?? [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await db.workouts.add(workout)
    await queueSync('workouts', workout.id)
    set((s) => ({ workouts: [...s.workouts, workout] }))
    return workout.id
  },

  updateWorkout: async (id, updates) => {
    await db.workouts.update(id, { ...updates, updatedAt: new Date() })
    await queueSync('workouts', id)
    set((s) => ({
      workouts: s.workouts.map((w) =>
        w.id === id ? { ...w, ...updates, updatedAt: new Date() } : w
      ),
    }))
  },

  deleteWorkout: async (id) => {
    await queueSync('workouts', id, 'delete')
    await db.workouts.delete(id)
    set((s) => ({ workouts: s.workouts.filter((w) => w.id !== id) }))
  },

  addExercise: async (data) => {
    const exercise: Exercise = {
      id: generateId(),
      ...data,
      createdAt: new Date(),
    }
    await db.exercises.add(exercise)
    await queueSync('exercises', exercise.id)
    set((s) => ({ exercises: [...s.exercises, exercise] }))
    return exercise.id
  },

  updateExercise: async (id, updates) => {
    await db.exercises.update(id, updates)
    await queueSync('exercises', id)
    set((s) => ({
      exercises: s.exercises.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }))
  },

  deleteExercise: async (id) => {
    await queueSync('exercises', id, 'delete')
    await db.exercises.delete(id)
    set((s) => ({ exercises: s.exercises.filter((e) => e.id !== id) }))
  },

  addExerciseToWorkout: async (workoutId, exerciseId) => {
    const workout = get().workouts.find((w) => w.id === workoutId)
    if (!workout) return
    const exerciseIds = [...workout.exerciseIds, exerciseId]
    await db.workouts.update(workoutId, { exerciseIds, updatedAt: new Date() })
    await queueSync('workouts', workoutId)
    set((s) => ({
      workouts: s.workouts.map((w) =>
        w.id === workoutId ? { ...w, exerciseIds, updatedAt: new Date() } : w
      ),
    }))
  },

  removeExerciseFromWorkout: async (workoutId, exerciseId) => {
    const workout = get().workouts.find((w) => w.id === workoutId)
    if (!workout) return
    const exerciseIds = workout.exerciseIds.filter((id) => id !== exerciseId)
    await db.workouts.update(workoutId, { exerciseIds, updatedAt: new Date() })
    await queueSync('workouts', workoutId)
    set((s) => ({
      workouts: s.workouts.map((w) =>
        w.id === workoutId ? { ...w, exerciseIds, updatedAt: new Date() } : w
      ),
    }))
  },

  reorderExercises: async (workoutId, newExerciseIds) => {
    // Optimistic update first so Reorder.Group sees the new values immediately
    set((s) => ({
      workouts: s.workouts.map((w) =>
        w.id === workoutId ? { ...w, exerciseIds: newExerciseIds, updatedAt: new Date() } : w
      ),
    }))
    await db.workouts.update(workoutId, { exerciseIds: newExerciseIds, updatedAt: new Date() })
    await queueSync('workouts', workoutId)
  },
}))
