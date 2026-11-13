'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DailyValue, SleepNight } from '@/lib/health'
import { maxHeartRate } from '@/lib/cardio'
import { useCardioStore } from '@/stores/useCardioStore'
import { useProfileStore } from '@/stores/useProfileStore'

type Status = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error'

interface HealthState {
  status: Status
  message: string | null
  sleep: SleepNight[]
  restingHr: DailyValue[]
  hrv: DailyValue[]
  vo2Max: DailyValue[]
  steps: DailyValue[]
  missing: string[]
  lastRefreshed: number | null
  refresh: (options?: { force?: boolean }) => Promise<{ imported: number } | null>
}

const MIN_INTERVAL_MS = 15 * 60_000
let running: Promise<{ imported: number } | null> | null = null

function reviveSeries(items: DailyValue[] | undefined) {
  return (items ?? []).map((item) => ({ ...item, date: new Date(item.date) }))
}

/**
 * Cached readings from Health Connect / Apple Health. Kept in localStorage so the
 * Saúde tab opens instantly (and offline); refreshed at most every 15 minutes.
 */
export const useHealthStore = create<HealthState>()(
  persist(
    (set, get) => ({
      status: 'idle',
      message: null,
      sleep: [],
      restingHr: [],
      hrv: [],
      vo2Max: [],
      steps: [],
      missing: [],
      lastRefreshed: null,

      refresh: async ({ force = false } = {}) => {
        if (running) return running
        const preferences = useProfileStore.getState().profile?.preferences
        if (!preferences?.healthSync) return null
        const last = get().lastRefreshed
        if (!force && last && Date.now() - last < MIN_INTERVAL_MS) return null

        running = (async () => {
          set({ status: 'loading', message: null })
          try {
            const health = await import('@/lib/health')
            const availability = await health.healthAvailable()
            if (!availability.available) {
              set({ status: 'unavailable', message: availability.reason ?? null })
              return null
            }
            const [missing, workouts, sleep, restingHr, hrv, vo2Max, steps] = await Promise.all([
              health.missingHealthPermissions(),
              health.readWorkouts(30).catch(() => []),
              health.readSleep(21).catch(() => []),
              health.readRestingHeartRate(90),
              health.readHrv(90),
              health.readVo2Max(365),
              health.readDailySteps(14),
            ])
            const imported = await useCardioStore.getState().importFromHealth(workouts, maxHeartRate(preferences))
            set({ status: 'ready', sleep, restingHr, hrv, vo2Max, steps, missing, lastRefreshed: Date.now() })
            return { imported }
          } catch (error) {
            set({ status: 'error', message: error instanceof Error ? error.message : 'Falha ao ler os dados de saúde' })
            return null
          } finally {
            running = null
          }
        })()
        return running
      },
    }),
    {
      name: 'workoutpro-health-cache',
      version: 1,
      partialize: (state) => ({
        sleep: state.sleep, restingHr: state.restingHr, hrv: state.hrv, vo2Max: state.vo2Max,
        steps: state.steps, missing: state.missing, lastRefreshed: state.lastRefreshed,
      }),
      merge: (persisted, current) => {
        const value = (persisted ?? {}) as Partial<HealthState>
        return {
          ...current,
          ...value,
          sleep: (value.sleep ?? []).map((night) => ({
            ...night,
            start: new Date(night.start),
            end: new Date(night.end),
            stages: night.stages.map((stage) => ({ ...stage, start: new Date(stage.start), end: new Date(stage.end) })),
          })),
          restingHr: reviveSeries(value.restingHr),
          hrv: reviveSeries(value.hrv),
          vo2Max: reviveSeries(value.vo2Max),
          steps: reviveSeries(value.steps),
        }
      },
    }
  )
)
