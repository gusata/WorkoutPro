'use client'

import { create } from 'zustand'
import { db, getProfile } from '@/lib/db'
import type { UserProfile, UserPreferences, WorkoutSession, BodyMeasurement, AchievementRecord } from '@/types'
import { format } from 'date-fns'
import { generateId } from '@/lib/utils'
import { ACHIEVEMENTS } from '@/lib/achievements'
import { queueSync } from '@/lib/syncQueue'
import { useCardioStore } from '@/stores/useCardioStore'

interface ProfileStore {
  profile: UserProfile | null
  sessions: WorkoutSession[]
  measurements: BodyMeasurement[]
  achievements: AchievementRecord[]
  newlyUnlocked: string[]
  loaded: boolean
  load: () => Promise<void>
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>
  importHealthMeasurements: () => Promise<number>
  addMeasurement: (m: Omit<BodyMeasurement, 'id' | 'updatedAt'>) => Promise<void>
  deleteMeasurement: (id: string) => Promise<void>
  checkAchievements: () => Promise<string[]>
  clearNewlyUnlocked: () => void
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profile: null,
  sessions: [],
  measurements: [],
  achievements: [],
  newlyUnlocked: [],
  loaded: false,

  load: async () => {
    const [profile, sessions, measurements, achievements] = await Promise.all([
      getProfile(),
      db.sessions.orderBy('startedAt').reverse().toArray(),
      db.measurements.orderBy('date').reverse().toArray(),
      db.achievements.toArray(),
    ])
    set({ profile, sessions, measurements, achievements, loaded: true })
    // Cardio lives in its own store; reloading here keeps it fresh after every sync/import.
    await useCardioStore.getState().load()
    await get().checkAchievements()
  },

  updateProfile: async (updates) => {
    const updatedAt = new Date()
    await db.transaction('rw', [db.profile, db.syncQueue], async () => {
      await db.profile.update('profile', { ...updates, updatedAt })
      await queueSync('profile', 'profile')
    })
    set((s) => ({ profile: s.profile ? { ...s.profile, ...updates, updatedAt } : s.profile }))
  },

  updatePreferences: async (updates) => {
    const current = get().profile?.preferences ?? {}
    await get().updateProfile({ preferences: { ...current, ...updates } })
  },

  addMeasurement: async (data) => {
    const measurement: BodyMeasurement = { id: generateId(), ...data, updatedAt: new Date() }
    await db.transaction('rw', [db.measurements, db.syncQueue], async () => {
      await db.measurements.add(measurement)
      await queueSync('measurements', measurement.id)
    })
    set((s) => ({ measurements: [measurement, ...s.measurements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) }))
    if (get().profile?.preferences?.healthSync && measurement.weight != null) {
      void import('@/lib/health').then(({ writeWeight }) => writeWeight(measurement.weight!, new Date(measurement.date))).catch(() => undefined)
    }
  },

  /** Adds weight / body-fat readings from the health app for days that have no measurement yet. */
  importHealthMeasurements: async () => {
    const { readBodyEntries } = await import('@/lib/health')
    const entries = await readBodyEntries(30)
    const existingDays = new Set(get().measurements.map((item) => format(new Date(item.date), 'yyyy-MM-dd')))
    let added = 0
    for (const entry of entries) {
      if (existingDays.has(format(entry.date, 'yyyy-MM-dd'))) continue
      if (entry.weight == null && entry.bodyFat == null) continue
      const measurement: BodyMeasurement = {
        id: generateId(), date: entry.date, weight: entry.weight, bodyFat: entry.bodyFat, leanMass: null,
        chest: null, arm: null, forearm: null, waist: null, hip: null, thigh: null, calf: null, updatedAt: new Date(),
      }
      await db.transaction('rw', [db.measurements, db.syncQueue], async () => {
        await db.measurements.add(measurement)
        await queueSync('measurements', measurement.id)
      })
      added += 1
    }
    if (added > 0) set({ measurements: await db.measurements.orderBy('date').reverse().toArray() })
    return added
  },

  deleteMeasurement: async (id) => {
    await db.transaction('rw', [db.measurements, db.syncQueue], async () => {
      await db.measurements.delete(id)
      await queueSync('measurements', id, 'delete')
    })
    set((s) => ({ measurements: s.measurements.filter((m) => m.id !== id) }))
  },

  checkAchievements: async () => {
    const { profile, sessions, achievements } = get()
    if (!profile) return []

    const unlockedIds = new Set(achievements.map((a) => a.id))
    const newlyUnlocked: string[] = []

    for (const def of ACHIEVEMENTS) {
      if (!unlockedIds.has(def.id) && def.condition(profile, sessions)) {
        const now = new Date()
        const record: AchievementRecord = { id: def.id, unlockedAt: now, updatedAt: now }
        const inserted = await db.transaction('rw', [db.achievements, db.syncQueue], async () => {
          if (await db.achievements.get(record.id)) return false
          await db.achievements.add(record)
          await queueSync('achievements', record.id)
          return true
        })
        if (inserted) newlyUnlocked.push(def.id)
      }
    }

    if (newlyUnlocked.length > 0) {
      const updated = await db.achievements.toArray()
      set({ achievements: updated, newlyUnlocked })
    }

    return newlyUnlocked
  },

  clearNewlyUnlocked: () => set({ newlyUnlocked: [] }),
}))
