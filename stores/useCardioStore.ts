'use client'

import { create } from 'zustand'
import { db } from '@/lib/db'
import { queueSync } from '@/lib/syncQueue'
import { generateId } from '@/lib/utils'
import { activityFromHealthType, isDuplicateCardio, isOwnHealthWorkout, timeInZones } from '@/lib/cardio'
import type { HealthWorkout } from '@/lib/health'
import type { CardioSession } from '@/types'

interface CardioStore {
  sessions: CardioSession[]
  loaded: boolean
  load: () => Promise<void>
  add: (data: Omit<CardioSession, 'id' | 'updatedAt'>) => Promise<CardioSession>
  update: (id: string, updates: Partial<CardioSession>) => Promise<void>
  remove: (id: string) => Promise<void>
  /** Imports new cardio workouts from the health store; returns how many were added. */
  importFromHealth: (workouts: HealthWorkout[], maxHr: number | null) => Promise<number>
}

const DISMISSED_KEY = 'workoutpro-cardio-dismissed'

/** Health-store workouts the user deleted here, so they are not imported again. */
function readDismissed(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? '[]')
  } catch {
    return []
  }
}

function dismissKey(item: Pick<CardioSession, 'externalId' | 'startedAt' | 'activity'>) {
  return item.externalId ?? `${item.activity}@${Math.round(new Date(item.startedAt).getTime() / 60_000)}`
}

function sortNewest(items: CardioSession[]) {
  return [...items].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
}

export const useCardioStore = create<CardioStore>((set, get) => ({
  sessions: [],
  loaded: false,

  load: async () => {
    const sessions = await db.cardio.orderBy('startedAt').reverse().toArray()
    set({ sessions, loaded: true })
  },

  add: async (data) => {
    const session: CardioSession = { ...data, id: generateId(), updatedAt: new Date() }
    await db.transaction('rw', [db.cardio, db.syncQueue], async () => {
      await db.cardio.add(session)
      await queueSync('cardio', session.id)
    })
    set((state) => ({ sessions: sortNewest([session, ...state.sessions]) }))
    return session
  },

  update: async (id, updates) => {
    const updatedAt = new Date()
    await db.transaction('rw', [db.cardio, db.syncQueue], async () => {
      await db.cardio.update(id, { ...updates, updatedAt })
      await queueSync('cardio', id)
    })
    set((state) => ({ sessions: sortNewest(state.sessions.map((item) => item.id === id ? { ...item, ...updates, updatedAt } : item)) }))
  },

  remove: async (id) => {
    const target = get().sessions.find((item) => item.id === id)
    if (target?.source === 'health') {
      try {
        window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...readDismissed(), dismissKey(target)].slice(-500)))
      } catch {
        // Without storage the workout may be imported again; harmless.
      }
    }
    await db.transaction('rw', [db.cardio, db.syncQueue], async () => {
      await db.cardio.delete(id)
      await queueSync('cardio', id, 'delete')
    })
    set((state) => ({ sessions: state.sessions.filter((item) => item.id !== id) }))
  },

  importFromHealth: async (workouts, maxHr) => {
    if (!get().loaded) await get().load()
    const existing = [...get().sessions]
    const dismissed = new Set(readDismissed())
    const fresh: CardioSession[] = []
    for (const workout of workouts) {
      if (isOwnHealthWorkout(workout)) continue
      const activity = activityFromHealthType(workout.type)
      if (!activity || workout.duration < 120) continue
      const candidate = { externalId: workout.externalId, startedAt: workout.startedAt, activity }
      if (dismissed.has(dismissKey(candidate)) || isDuplicateCardio([...existing, ...fresh], candidate)) continue
      // Heart rate during the workout: averages, peak and time in zones.
      const { heartRateSamples } = await import('@/lib/health')
      const samples = await heartRateSamples(workout.startedAt, workout.endedAt)
      const bpms = samples.map((sample) => sample.bpm)
      fresh.push({
        id: generateId(),
        activity,
        startedAt: workout.startedAt,
        duration: workout.duration,
        distance: workout.distance && workout.distance > 0 ? Math.round(workout.distance) : null,
        calories: workout.calories,
        avgHeartRate: bpms.length ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : null,
        maxHeartRate: bpms.length ? Math.max(...bpms) : null,
        zones: maxHr && samples.length ? timeInZones(samples, maxHr, workout.endedAt) : null,
        effort: null,
        source: 'health',
        externalId: workout.externalId,
        sourceName: workout.sourceName,
        notes: '',
        updatedAt: new Date(),
      })
    }
    if (fresh.length === 0) return 0
    await db.transaction('rw', [db.cardio, db.syncQueue], async () => {
      await db.cardio.bulkAdd(fresh)
      for (const item of fresh) await queueSync('cardio', item.id)
    })
    set((state) => ({ sessions: sortNewest([...fresh, ...state.sessions]) }))
    return fresh.length
  },
}))
