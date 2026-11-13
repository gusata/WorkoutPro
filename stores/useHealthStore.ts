'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DailyValue, HeartDay, HeartToday, SleepNight } from '@/lib/health'
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
  heartToday: HeartToday | null
  heartDaily: HeartDay[]
  missing: string[]
  lastRefreshed: number | null
  lastLive: number | null
  refresh: (options?: { force?: boolean }) => Promise<{ imported: number } | null>
  /** Cheap update of today's heart rate and steps, for screens that stay open. */
  refreshLive: () => Promise<void>
}

/** Full refresh when the app opens or returns to the foreground. */
const MIN_INTERVAL_MS = 60_000
/** Heart rate + steps while a health screen is open. */
export const LIVE_INTERVAL_MS = 60_000
let running: Promise<{ imported: number } | null> | null = null

function reviveHeartToday(value: HeartToday | null | undefined): HeartToday | null {
  if (!value) return null
  const revived = {
    ...value,
    latest: value.latest ? { ...value.latest, time: new Date(value.latest.time) } : null,
    points: value.points.map((point) => ({ ...point, time: new Date(point.time) })),
  }
  // A cache from a previous day is not "today" anymore.
  return revived.latest && revived.latest.time.toDateString() === new Date().toDateString() ? revived : null
}

function reviveSeries(items: DailyValue[] | undefined) {
  return (items ?? []).map((item) => ({ ...item, date: new Date(item.date) }))
}

/**
 * Cached readings from Health Connect / Apple Health. Kept in localStorage so the
 * Saúde tab opens instantly (and offline). Full refresh at most once a minute when the
 * app opens or returns to the foreground; open health screens poll heart rate and steps.
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
      heartToday: null,
      heartDaily: [],
      missing: [],
      lastRefreshed: null,
      lastLive: null,

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
            const [missing, workouts, sleep, restingHr, hrv, vo2Max, steps, heartToday, heartDaily] = await Promise.all([
              health.missingHealthPermissions(),
              health.readWorkouts(30).catch(() => []),
              health.readSleep(21).catch(() => []),
              health.readRestingHeartRate(90),
              health.readHrv(90),
              health.readVo2Max(365),
              health.readDailySteps(14),
              health.readHeartToday().catch(() => null),
              health.readHeartDaily(7),
            ])
            const imported = await useCardioStore.getState().importFromHealth(workouts, maxHeartRate(preferences))
            set({ status: 'ready', sleep, restingHr, hrv, vo2Max, steps, heartToday, heartDaily, missing, lastRefreshed: Date.now(), lastLive: Date.now() })
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

      refreshLive: async () => {
        if (running) return
        if (!useProfileStore.getState().profile?.preferences?.healthSync) return
        try {
          const health = await import('@/lib/health')
          const [heartToday, stepsToday] = await Promise.all([health.readHeartToday(), health.readStepsToday()])
          set((state) => {
            const today = new Date().toDateString()
            const steps = stepsToday == null ? state.steps : [
              ...state.steps.filter((day) => day.date.toDateString() !== today),
              { date: new Date(new Date().setHours(0, 0, 0, 0)), value: stepsToday },
            ].sort((a, b) => a.date.getTime() - b.date.getTime())
            return { heartToday, steps, lastLive: Date.now() }
          })
        } catch {
          // Next tick tries again; the cached values stay on screen.
        }
      },
    }),
    {
      name: 'workoutpro-health-cache',
      version: 1,
      partialize: (state) => ({
        sleep: state.sleep, restingHr: state.restingHr, hrv: state.hrv, vo2Max: state.vo2Max,
        steps: state.steps, heartToday: state.heartToday, heartDaily: state.heartDaily,
        missing: state.missing, lastRefreshed: state.lastRefreshed, lastLive: state.lastLive,
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
          heartToday: reviveHeartToday(value.heartToday),
          heartDaily: (value.heartDaily ?? []).map((day) => ({ ...day, date: new Date(day.date) })),
        }
      },
    }
  )
)
