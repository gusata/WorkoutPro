'use client'

import { create } from 'zustand'
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware'
import { db } from '@/lib/db'
import type { ActiveExercise, ActiveSession, ActiveSet, DiscomfortNote, WorkoutSession, Workout, Exercise } from '@/types'
import { generateId } from '@/lib/utils'
import { xpForWorkout } from '@/lib/gamification'
import { queueSync } from '@/lib/syncQueue'
import { estimateOneRm } from '@/lib/exerciseHistory'
import { applySessionToProfile } from '@/lib/profileStats'
import { useTimerStore } from '@/stores/useTimerStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { differenceInCalendarDays } from 'date-fns'
import { applyPlanToSets } from '@/lib/trainingBlocks'

const isWorkSet = (set: Pick<ActiveSet, 'setType'>) => (set.setType ?? 'normal') !== 'warmup'

export type FinishedSession = WorkoutSession & { newPrs: number }

/**
 * localStorage writes are synchronous and serialize the whole active session.
 * Typing a weight would otherwise stringify + write on every keystroke, so writes
 * are coalesced and flushed after a short pause or when the app is backgrounded.
 */
function createDebouncedStorage<S>(delay = 400): PersistStorage<S> {
  const pending = new Map<string, StorageValue<S> | null>()
  let timer: ReturnType<typeof setTimeout> | undefined

  function flush() {
    if (timer) clearTimeout(timer)
    timer = undefined
    for (const [name, value] of pending) {
      try {
        if (value === null) window.localStorage.removeItem(name)
        else window.localStorage.setItem(name, JSON.stringify(value))
      } catch {
        // Quota/private mode: the in-memory session keeps working.
      }
    }
    pending.clear()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
  }

  return {
    getItem: (name) => {
      if (pending.has(name)) return pending.get(name) ?? null
      try {
        const raw = window.localStorage.getItem(name)
        return raw ? (JSON.parse(raw) as StorageValue<S>) : null
      } catch {
        return null
      }
    },
    setItem: (name, value) => {
      pending.set(name, value)
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, delay)
    },
    removeItem: (name) => {
      pending.set(name, null)
      flush()
    },
  }
}

/** Text for the Health Connect session: exercises with their completed sets, then the notes. */
export function healthSessionNotes(active: Pick<ActiveSession, 'exercises' | 'notes'>, totalVolume: number) {
  const lines = active.exercises
    .map((exercise) => ({ name: exercise.exerciseName, sets: exercise.sets.filter((item) => item.completed).length }))
    .filter((item) => item.sets > 0)
    .map((item) => `${item.name}: ${item.sets} ${item.sets === 1 ? 'série' : 'séries'}`)
  if (totalVolume > 0) lines.push(`Volume: ${Math.round(totalVolume)} kg`)
  if (active.notes?.trim()) lines.push(active.notes.trim())
  return lines.join('\n')
}

/**
 * Mirrors the finished session to Health Connect when sync is on. Fire-and-forget:
 * the write is idempotent (session id as clientRecordId) and failures stay silent.
 */
function exportToHealth(active: ActiveSession, session: WorkoutSession) {
  const profileState = useProfileStore.getState()
  if (!profileState.profile?.preferences?.healthSync || !session.finishedAt) return
  const bodyWeight = profileState.measurements.find((item) => item.weight != null)?.weight ?? null
  void Promise.all([import('@/lib/health'), import('@/lib/liveHeart')]).then(([health, live]) =>
    health.writeStrengthSession({
      id: session.id,
      title: active.workoutName,
      startedAt: new Date(session.startedAt),
      finishedAt: new Date(session.finishedAt!),
      notes: healthSessionNotes(active, session.totalVolume),
      activeCalories: live.estimateStrengthCalories(session.duration, bodyWeight),
    })
  ).catch(() => undefined)
}

interface SessionStore {
  active: ActiveSession | null
  startSession: (workout: Workout, exercises: Exercise[]) => Promise<void>
  endSession: () => Promise<FinishedSession | null>
  discardSession: () => void
  addSet: (exerciseId: string, set: Omit<ActiveSet, 'id' | 'completed' | 'completedAt'>) => void
  updateSet: (exerciseId: string, setId: string, updates: Partial<ActiveSet>) => void
  completeSet: (exerciseId: string, setId: string) => void
  removeSet: (exerciseId: string, setId: string) => void
  duplicateSet: (exerciseId: string, setId: string) => void
  applySetToFollowing: (exerciseId: string, setId: string) => void
  updateExerciseNotes: (exerciseId: string, notes: string) => void
  replaceExercise: (exerciseId: string, replacement: Exercise, previousSets?: ActiveExercise['previousSets']) => void
  insertWarmupSets: (exerciseId: string, steps: Array<{ weight: number; reps: number }>) => void
  setRestSeconds: (exerciseId: string, seconds: number) => void
  moveExercise: (exerciseId: string, direction: -1 | 1) => void
  setExerciseDiscomfort: (exerciseId: string, discomfort: DiscomfortNote | null) => void
  applyExercisePlan: (exerciseId: string, plan: { sets: number; weight: number | null }) => void
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
          .toArray()
        const lastSession = lastSessions
          .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0] ?? null
        const startedAt = new Date()

        useTimerStore.getState().resetWorkoutTimer()

        set({
          active: {
            sessionId: generateId(),
            workoutId: workout.id,
            workoutName: workout.name,
            workoutColor: workout.color,
            startedAt,
            notes: '',
            exercises: exercises.map((e) => {
              const lastEx = lastSession?.exercises.find((le) => le.exerciseId === e.id)
              const prevSets = lastEx?.sets ?? []
              const config = workout.exerciseConfigs?.find((item) => item.exerciseId === e.id)
              const targetSets = Math.max(1, config?.targetSets ?? (prevSets.length || 3))
              const sourceSets = prevSets.length > 0
                ? prevSets
                : Array.from({ length: targetSets }, () => ({ weight: 0, reps: config?.minReps ?? 0, rpe: null }))
              return {
                exerciseId: e.id,
                exerciseName: e.name,
                muscleGroup: e.muscleGroup,
                notes: e.notes,
                machineSettings: e.machineSettings,
                equipment: e.equipment,
                previousSets: prevSets.map((set) => ({
                  weight: set.weight, reps: set.reps, rpe: set.rpe, rir: set.rir, setType: set.setType,
                })),
                supersetId: config?.supersetId,
                targetMinReps: config?.minReps ?? 8,
                targetMaxReps: config?.maxReps ?? 12,
                progression: config?.progression,
                restSeconds: config?.restSeconds ?? 90,
                sets: sourceSets.map((ps) => ({
                      id: generateId(),
                      weight: ps.weight,
                      reps: ps.reps,
                      rpe: null,
                      rir: 'rir' in ps ? ps.rir : null,
                      setType: 'setType' in ps ? (ps.setType ?? 'normal') : 'normal',
                      completed: false,
                      completedAt: null,
                    })),
              }
            }),
          },
        })
        useTimerStore.getState().startWorkoutTimer(startedAt.getTime())
      },

      endSession: async () => {
        const { active } = get()
        if (!active) return null

        const finishedAt = new Date()
        const duration = Math.floor((finishedAt.getTime() - new Date(active.startedAt).getTime()) / 1000)

        let totalVolume = 0
        const sessionExercises = active.exercises.map((ae) => {
          const completedSets = ae.sets.filter((s) => s.completed)
          // Warm-ups are recorded but never count as volume.
          completedSets.filter(isWorkSet).forEach((s) => {
            totalVolume += s.weight * s.reps
          })
          return {
            exerciseId: ae.exerciseId,
            ...(ae.discomfort ? { discomfort: ae.discomfort } : {}),
            sets: completedSets.map((s) => ({
              id: s.id,
              weight: s.weight,
              reps: s.reps,
              rpe: s.rpe,
              rir: s.rir ?? null,
              setType: s.setType ?? 'normal',
              ...(s.videoId ? { videoId: s.videoId } : {}),
              completedAt: s.completedAt ?? new Date(),
            })),
          }
        })

        // Reuse the history already in memory instead of reading every session from IndexedDB again.
        const profileState = useProfileStore.getState()
        const previousSessions = profileState.loaded ? profileState.sessions : await db.sessions.toArray()
        const bestByExercise = new Map<string, number>()
        const trainedIds = new Set(sessionExercises.filter((item) => item.sets.length > 0).map((item) => item.exerciseId))
        for (const previous of previousSessions) {
          if (previous.id === active.sessionId) continue
          for (const item of previous.exercises) {
            if (!trainedIds.has(item.exerciseId)) continue
            for (const set of item.sets) {
              if (!isWorkSet(set)) continue
              const estimate = estimateOneRm(set.weight, set.reps)
              if (estimate > (bestByExercise.get(item.exerciseId) ?? 0)) bestByExercise.set(item.exerciseId, estimate)
            }
          }
        }
        let newPrs = 0
        for (const exercise of sessionExercises) {
          if (exercise.sets.length === 0) continue
          const previousBest = bestByExercise.get(exercise.exerciseId) ?? 0
          const currentBest = exercise.sets.filter(isWorkSet).reduce(
            (best, set) => Math.max(best, estimateOneRm(set.weight, set.reps)),
            0
          )
          if (currentBest > previousBest) newPrs += 1
        }

        const profileBefore = await db.profile.get('profile')
        const previousDay = profileBefore?.lastWorkoutDate
          ? new Date(profileBefore.lastWorkoutDate)
          : null
        const streakBonus = previousDay != null && differenceInCalendarDays(new Date(), previousDay) === 1
        const xpEarned = xpForWorkout(totalVolume, newPrs, streakBonus)
        const sessionId = active.sessionId || generateId()

        const session: WorkoutSession = {
          id: sessionId,
          workoutId: active.workoutId,
          startedAt: new Date(active.startedAt),
          finishedAt,
          duration,
          exercises: sessionExercises,
          totalVolume,
          xpEarned,
          notes: active.notes,
          updatedAt: finishedAt,
        }

        let persisted = session
        await db.transaction('rw', [db.sessions, db.profile, db.syncQueue], async () => {
          const existing = await db.sessions.get(sessionId)
          if (existing) {
            persisted = existing
            return
          }
          const profile = await db.profile.get('profile')
          if (!profile) throw new Error('Perfil local ausente')
          await db.sessions.add(session)
          await db.profile.put(applySessionToProfile(profile, session, finishedAt))
          await queueSync('sessions', session.id)
          await queueSync('profile', 'profile')
        })

        set((state) => state.active?.sessionId === sessionId ? { active: null } : state)
        useTimerStore.getState().resetWorkoutTimer()
        exportToHealth(active, persisted)
        return { ...persisted, newPrs }
      },

      discardSession: () => {
        set({ active: null })
        useTimerStore.getState().resetWorkoutTimer()
      },

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

      duplicateSet: (exerciseId, setId) => {
        set((state) => {
          if (!state.active) return state
          return {
            active: {
              ...state.active,
              exercises: state.active.exercises.map((exercise) => {
                if (exercise.exerciseId !== exerciseId) return exercise
                const index = exercise.sets.findIndex((item) => item.id === setId)
                if (index < 0) return exercise
                const sets = [...exercise.sets]
                sets.splice(index + 1, 0, {
                  ...sets[index], id: generateId(), completed: false, completedAt: null,
                })
                return { ...exercise, sets }
              }),
            },
          }
        })
      },

      applySetToFollowing: (exerciseId, setId) => {
        set((state) => {
          if (!state.active) return state
          return {
            active: {
              ...state.active,
              exercises: state.active.exercises.map((exercise) => {
                if (exercise.exerciseId !== exerciseId) return exercise
                const index = exercise.sets.findIndex((item) => item.id === setId)
                const source = exercise.sets[index]
                if (!source) return exercise
                return {
                  ...exercise,
                  sets: exercise.sets.map((item, setIndex) => setIndex <= index ? item : {
                    ...item, weight: source.weight, reps: source.reps, rpe: source.rpe,
                    rir: source.rir, setType: source.setType,
                  }),
                }
              }),
            },
          }
        })
      },

      updateExerciseNotes: (exerciseId, notes) => {
        set((state) => !state.active ? state : ({
          active: {
            ...state.active,
            exercises: state.active.exercises.map((exercise) =>
              exercise.exerciseId === exerciseId ? { ...exercise, notes } : exercise
            ),
          },
        }))
      },

      replaceExercise: (exerciseId, replacement, previousSets = []) => {
        set((state) => !state.active ? state : ({
          active: {
            ...state.active,
            exercises: state.active.exercises.map((exercise) => {
              if (exercise.exerciseId !== exerciseId) return exercise
              return {
                ...exercise,
                exerciseId: replacement.id,
                exerciseName: replacement.name,
                muscleGroup: replacement.muscleGroup,
                notes: replacement.notes,
                machineSettings: replacement.machineSettings,
                equipment: replacement.equipment,
                discomfort: null,
                warmupGenerated: false,
                previousSets,
                // Pre-fill untouched sets with the replacement's own history.
                sets: exercise.sets.map((item, index) => {
                  const previous = previousSets[index] ?? previousSets.at(-1)
                  if (item.completed || !previous) return item
                  return { ...item, weight: previous.weight, reps: previous.reps, rir: previous.rir ?? item.rir }
                }),
              }
            }),
          },
        }))
      },

      insertWarmupSets: (exerciseId, steps) => {
        set((state) => !state.active ? state : ({
          active: {
            ...state.active,
            exercises: state.active.exercises.map((exercise) => {
              if (exercise.exerciseId !== exerciseId) return exercise
              // Replace warm-ups that were not done yet instead of stacking them.
              const kept = exercise.sets.filter((item) => item.completed || (item.setType ?? 'normal') !== 'warmup')
              const warmups: ActiveSet[] = steps.map((step) => ({
                id: generateId(), weight: step.weight, reps: step.reps, rpe: null, rir: null,
                setType: 'warmup', completed: false, completedAt: null,
              }))
              return { ...exercise, warmupGenerated: true, sets: [...warmups, ...kept] }
            }),
          },
        }))
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

      setExerciseDiscomfort: (exerciseId, discomfort) => {
        set((state) => !state.active ? state : ({
          active: {
            ...state.active,
            exercises: state.active.exercises.map((exercise) =>
              exercise.exerciseId === exerciseId ? { ...exercise, discomfort } : exercise
            ),
          },
        }))
      },

      applyExercisePlan: (exerciseId, plan) => {
        set((state) => !state.active ? state : ({
          active: {
            ...state.active,
            exercises: state.active.exercises.map((exercise) =>
              exercise.exerciseId === exerciseId
                ? { ...exercise, sets: applyPlanToSets(exercise.sets, plan.sets, plan.weight) }
                : exercise
            ),
          },
        }))
      },

      moveExercise: (exerciseId, direction) => {
        set((state) => {
          if (!state.active) return state
          const currentIndex = state.active.exercises.findIndex((exercise) => exercise.exerciseId === exerciseId)
          const nextIndex = currentIndex + direction
          if (currentIndex < 0 || nextIndex < 0 || nextIndex >= state.active.exercises.length) return state
          const exercises = [...state.active.exercises]
          const [moved] = exercises.splice(currentIndex, 1)
          exercises.splice(nextIndex, 0, moved)
          return { active: { ...state.active, exercises } }
        })
      },
    }),
    {
      name: 'workout-session',
      version: 2,
      migrate: (persisted) => {
        const state = persisted as { active?: ActiveSession | null }
        if (state.active && !state.active.sessionId) {
          state.active = { ...state.active, sessionId: generateId() }
        }
        return state
      },
      partialize: (state) => ({ active: state.active }),
      storage: createDebouncedStorage<{ active?: ActiveSession | null }>(),
    }
  )
)
