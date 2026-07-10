'use client'

import { create } from 'zustand'
import { db, getProfile } from '@/lib/db'
import type { UserProfile, WorkoutSession, BodyMeasurement, AchievementRecord } from '@/types'
import { generateId } from '@/lib/utils'
import { ACHIEVEMENTS } from '@/lib/achievements'
import { queueSync } from '@/lib/syncQueue'

interface ProfileStore {
  profile: UserProfile | null
  sessions: WorkoutSession[]
  measurements: BodyMeasurement[]
  achievements: AchievementRecord[]
  newlyUnlocked: string[]
  loaded: boolean
  load: () => Promise<void>
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>
  addMeasurement: (m: Omit<BodyMeasurement, 'id'>) => Promise<void>
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
    await get().checkAchievements()
  },

  updateProfile: async (updates) => {
    await db.profile.update('profile', updates)
    await queueSync('profile', 'profile')
    set((s) => ({ profile: s.profile ? { ...s.profile, ...updates } : s.profile }))
  },

  addMeasurement: async (data) => {
    const measurement: BodyMeasurement = { id: generateId(), ...data }
    await db.measurements.add(measurement)
    await queueSync('measurements', measurement.id)
    set((s) => ({ measurements: [measurement, ...s.measurements] }))
  },

  deleteMeasurement: async (id) => {
    await queueSync('measurements', id, 'delete')
    await db.measurements.delete(id)
    set((s) => ({ measurements: s.measurements.filter((m) => m.id !== id) }))
  },

  checkAchievements: async () => {
    const { profile, sessions, achievements } = get()
    if (!profile) return []

    const unlockedIds = new Set(achievements.map((a) => a.id))
    const newlyUnlocked: string[] = []

    for (const def of ACHIEVEMENTS) {
      if (!unlockedIds.has(def.id) && def.condition(profile, sessions)) {
        const record: AchievementRecord = { id: def.id, unlockedAt: new Date() }
        await db.achievements.add(record)
        await queueSync('achievements', record.id)
        newlyUnlocked.push(def.id)
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
