'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { db } from '@/lib/db'
import type { ActiveSession, ActiveSet, WorkoutSession, Workout, Exercise } from '@/types'
import { generateId } from '@/lib/utils'
import { xpForWorkout } from '@/lib/gamification'

interface SessionStore {
  active: ActiveSession | null
  startSession: (workout: Workout, exercises: Exercise[]) => Promise<void>
  endSession: () => Promise<WorkoutSession | null>
  discardSession: () => void
  addSet: (exerciseId: string, set: Omit<ActiveSet, 'id' | 'completed' | 'completedAt'>) => void
  updateSet: (exerciseId: string, setId: string, updates: Partial<ActiveSet>) => void
  completeSet: (exerciseId: string, setId: string) => void
  removeSet: (exerciseId: string, setId: string) => void
  setRestSeconds: (exerciseId: string, seconds: number) => void
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      active: null,

      startSession: async (workout, exercises) => {
        // Look up the last completed session for this workout to pre-fill weights/reps
        const lastSessions = await db.sessions
          .where('workoutId')
          .equals(workout.id)
          .reverse()
          .sortBy('startedAt')
        const lastSession = lastSessions[0] ?? null

        set({
          active: {
            workoutId: workout.id,
            workoutName: workout.name,
            workoutColor: workout.color,
            startedAt: new Date(),
            notes: '',
            exercises: exercises.map((e) => {
              const lastEx = lastSession?.exercises.find((le) => le.exerciseId === e.id)
              const prevSets = lastEx?.sets ?? []
              return {
                exerciseId: e.id,
                exerciseName: e.name,
                muscleGroup: e.muscleGroup,
                notes: e.notes,
                restSeconds: 90,
                sets: prevSets.length > 0
                  ? prevSets.map((ps) => ({
                      id: generateId(),
                      weight: ps.weight,
                      reps: ps.reps,
                      rpe: null,
                      completed: false,
                      completedAt: null,
                    }))
                  : [{ id: generateId(), weight: 0, reps: 0, rpe: null, completed: false, completedAt: null }],
              }
            }),
          },
        })
      },

      endSession: async () => {
        const { active } = get()
        if (!active) return null

        const finishedAt = new Date()
        const duration = Math.floor((finishedAt.getTime() - new Date(active.startedAt).getTime()) / 1000)

        let totalVolume = 0
        const sessionExercises = active.exercises.map((ae) => {
          const completedSets = ae.sets.filter((s) => s.completed)
          completedSets.forEach((s) => {
            totalVolume += s.weight * s.reps
          })
          return {
            exerciseId: ae.exerciseId,
            sets: completedSets.map((s) => ({
              id: s.id,
              weight: s.weight,
              reps: s.reps,
              rpe: s.rpe,
              completedAt: s.completedAt ?? new Date(),
            })),
          }
        })

        const xpEarned = xpForWorkout(totalVolume, 0, false)

        const session: WorkoutSession = {
          id: generateId(),
          workoutId: active.workoutId,
          startedAt: new Date(active.startedAt),
          finishedAt,
          duration,
          exercises: sessionExercises,
          totalVolume,
          xpEarned,
          notes: active.notes,
        }

        await db.sessions.add(session)

        const profile = await db.profile.get('profile')
        if (profile) {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const last = profile.lastWorkoutDate ? new Date(profile.lastWorkoutDate) : null
          let streak = profile.streak
          if (last) {
            const lastDay = new Date(last)
            lastDay.setHours(0, 0, 0, 0)
            const diff = (today.getTime() - lastDay.getTime()) / 86400000
            if (diff === 1) streak++
            else if (diff > 1) streak = 1
          } else {
            streak = 1
          }
          const longestStreak = Math.max(profile.longestStreak, streak)
          const newXp = profile.xp + xpEarned
          const { getLevelFromXp } = await import('@/lib/gamification')
          const { level } = getLevelFromXp(newXp)
          await db.profile.update('profile', {
            totalVolume: profile.totalVolume + totalVolume,
            totalWorkouts: profile.totalWorkouts + 1,
            xp: newXp,
            level,
            streak,
            longestStreak,
            lastWorkoutDate: new Date(),
          })
        }

        set({ active: null })
        return session
      },

      discardSession: () => set({ active: null }),

      addSet: (exerciseId, setData) => {
        set((s) => {
          if (!s.active) return s
          return {
            active: {
              ...s.active,
              exercises: s.active.exercises.map((e) =>
                e.exerciseId === exerciseId
                  ? {
                      ...e,
                      sets: [
                        ...e.sets,
                        { ...setData, id: generateId(), completed: false, completedAt: null },
                      ],
                    }
                  : e
              ),
            },
          }
        })
      },

      updateSet: (exerciseId, setId, updates) => {
        set((s) => {
          if (!s.active) return s
          return {
            active: {
              ...s.active,
              exercises: s.active.exercises.map((e) =>
                e.exerciseId === exerciseId
                  ? { ...e, sets: e.sets.map((st) => (st.id === setId ? { ...st, ...updates } : st)) }
                  : e
              ),
            },
          }
        })
      },

      completeSet: (exerciseId, setId) => {
        set((s) => {
          if (!s.active) return s
          return {
            active: {
              ...s.active,
              exercises: s.active.exercises.map((e) =>
                e.exerciseId === exerciseId
                  ? {
                      ...e,
                      sets: e.sets.map((st) =>
                        st.id === setId
                          ? { ...st, completed: !st.completed, completedAt: !st.completed ? new Date() : null }
                          : st
                      ),
                    }
                  : e
              ),
            },
          }
        })
      },

      removeSet: (exerciseId, setId) => {
        set((s) => {
          if (!s.active) return s
          return {
            active: {
              ...s.active,
              exercises: s.active.exercises.map((e) =>
                e.exerciseId === exerciseId
                  ? { ...e, sets: e.sets.filter((st) => st.id !== setId) }
                  : e
              ),
            },
          }
        })
      },

      setRestSeconds: (exerciseId, seconds) => {
        set((s) => {
          if (!s.active) return s
          return {
            active: {
              ...s.active,
              exercises: s.active.exercises.map((e) =>
                e.exerciseId === exerciseId ? { ...e, restSeconds: seconds } : e
              ),
            },
          }
        })
      },
    }),
    {
      name: 'workout-session',
    }
  )
)
