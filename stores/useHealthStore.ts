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
  /** Cheap update of today's heart rate and/or steps. */
  refreshLive: (what?: { heart?: boolean; steps?: boolean }) => Promise<void>
  /**
   * Asks Health Connect what changed since the last check and reads only that.
   * Safe to call every few seconds; without the Changes API (web, iOS) it falls
   * back to throttled polling.
   */
  checkChanges: () => Promise<void>
}

/** Full re-read when nothing tells us what changed (fallback without the Changes API). */
const MIN_INTERVAL_MS = 15 * 60_000
/** Even with the Changes API, re-read everything now and then (e.g. day rollover). */
const SAFETY_INTERVAL_MS = 6 * 60 * 60_000
/** How often the open app asks Health Connect for changes. */
export const CHANGES_INTERVAL_MS = 10_000
/** Fallback polling of heart rate + steps without the Changes API. */
const LIVE_INTERVAL_MS = 60_000
const LIVE_TYPES = new Set(['heartRate', 'steps'])
let running: Promise<{ imported: number } | null> | null = null
let checking = false

function startOfToday() {
  return new Date(new Date().setHours(0, 0, 0, 0))
}

/** Today's row in the 7-day list follows the live reading instead of waiting for a full refresh. */
function withToday(days: HeartDay[], today: HeartToday | null): HeartDay[] {
  if (today?.min == null || today.max == null || today.avg == null) return days
  const date = startOfToday()
  return [...days.filter((day) => day.date.toDateString() !== date.toDateString()), { date, min: today.min, max: today.max, avg: today.avg }]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
}

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
 * Saúde tab opens instantly (and offline). On Android the open app checks the Health
 * Connect Changes API every few seconds and reads only the data that changed.
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

      refreshLive: async ({ heart = true, steps = true } = {}) => {
        if (running) return
        if (!useProfileStore.getState().profile?.preferences?.healthSync) return
        try {
          const health = await import('@/lib/health')
          const [heartToday, stepsToday] = await Promise.all([
            heart ? health.readHeartToday(new Date(), get().heartToday) : Promise.resolve(undefined),
            steps ? health.readStepsToday() : Promise.resolve(undefined),
          ])
          set((state) => {
            const today = new Date().toDateString()
            const nextSteps = stepsToday == null ? state.steps : [
              ...state.steps.filter((day) => day.date.toDateString() !== today),
              { date: startOfToday(), value: stepsToday },
            ].sort((a, b) => a.date.getTime() - b.date.getTime())
            const nextHeart = heartToday === undefined ? state.heartToday : heartToday
            return {
              heartToday: nextHeart,
              heartDaily: heartToday === undefined ? state.heartDaily : withToday(state.heartDaily, nextHeart),
              steps: nextSteps,
              lastLive: Date.now(),
            }
          })
        } catch {
          // Next tick tries again; the cached values stay on screen.
        }
      },

      checkChanges: async () => {
        if (running || checking) return
        if (!useProfileStore.getState().profile?.preferences?.healthSync) return
        checking = true
        try {
          const { checkHealthChanges } = await import('@/lib/healthChanges')
          const result = await checkHealthChanges()
          if (result === null) {
            // No Changes API here: plain throttled polling.
            await get().refresh()
            const lastLive = get().lastLive
            if (!lastLive || Date.now() - lastLive >= LIVE_INTERVAL_MS) await get().refreshLive()
            return
          }
          if (!result.available) {
            await get().refresh()
            return
          }
          const changed = result.changed ?? []
          const lastRefreshed = get().lastRefreshed
          const stale = !lastRefreshed || Date.now() - lastRefreshed >= SAFETY_INTERVAL_MS
          // Sleep, workouts, trends or deletions are rare: re-read everything for those.
          if (result.reset || stale || changed.some((type) => !LIVE_TYPES.has(type))) {
            await get().refresh({ force: true })
          } else if (changed.length > 0) {
            await get().refreshLive({ heart: changed.includes('heartRate'), steps: changed.includes('steps') })
          }
        } catch {
          // Health Connect busy or permission revoked mid-check: the next tick retries.
        } finally {
          checking = false
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
