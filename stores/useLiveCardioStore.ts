'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { maxHeartRate, timeInZones } from '@/lib/cardio'
import { mergeSamples } from '@/lib/liveHeart'
import type { HeartSample } from '@/lib/health'
import { useCardioStore } from '@/stores/useCardioStore'
import { useProfileStore } from '@/stores/useProfileStore'
import type { CardioActivity, CardioSession } from '@/types'

/** Shorter activities are discarded on stop instead of saved. */
export const MIN_LIVE_SECONDS = 60

export interface LiveCardio {
  activity: CardioActivity
  /** Epoch ms. */
  startedAt: number
  /** Heart-rate samples read so far, as [epoch ms, bpm] (compact for localStorage). */
  samples: Array<[number, number]>
}

interface LiveCardioStore {
  live: LiveCardio | null
  start: (activity: CardioActivity) => void
  /** Reads the heart-rate samples recorded since the last one (cheap, incremental). */
  pull: () => Promise<void>
  /** Saves the activity as a cardio session (zones from Health Connect); null when too short. */
  stop: () => Promise<CardioSession | null>
  discard: () => void
}

export function toSamples(pairs: Array<[number, number]>): HeartSample[] {
  return pairs.map(([time, bpm]) => ({ time: new Date(time), bpm }))
}

function toPairs(samples: HeartSample[]): Array<[number, number]> {
  return samples.map((sample) => [sample.time.getTime(), sample.bpm])
}

function healthSyncOn() {
  return useProfileStore.getState().profile?.preferences?.healthSync ?? false
}

let pulling = false

export const useLiveCardioStore = create<LiveCardioStore>()(
  persist(
    (set, get) => ({
      live: null,

      start: (activity) => {
        if (get().live) return
        set({ live: { activity, startedAt: Date.now(), samples: [] } })
      },

      pull: async () => {
        const live = get().live
        if (!live || pulling || !healthSyncOn()) return
        pulling = true
        try {
          const last = live.samples.at(-1)?.[0]
          const { heartRateSamples } = await import('@/lib/health')
          const fresh = (await heartRateSamples(new Date(last ?? live.startedAt), new Date()))
            .filter((sample) => last == null ? sample.time.getTime() >= live.startedAt : sample.time.getTime() > last)
          if (fresh.length === 0) return
          set((state) => state.live?.startedAt === live.startedAt
            ? { live: { ...state.live, samples: toPairs(mergeSamples(toSamples(state.live.samples), fresh)) } }
            : state)
        } finally {
          pulling = false
        }
      },

      stop: async () => {
        const live = get().live
        if (!live) return null
        const end = new Date()
        const duration = Math.round((end.getTime() - live.startedAt) / 1000)
        set({ live: null })
        if (duration < MIN_LIVE_SECONDS) return null

        // Health Connect is the source of truth: the watch may sync late samples at the end.
        let samples = toSamples(live.samples)
        if (healthSyncOn()) {
          const { heartRateSamples } = await import('@/lib/health')
          const read = await heartRateSamples(new Date(live.startedAt), end)
          samples = mergeSamples(samples, read)
        }
        samples = samples.filter((sample) => sample.time.getTime() >= live.startedAt && sample.time <= end)
        const bpms = samples.map((sample) => sample.bpm)
        const maxHr = maxHeartRate(useProfileStore.getState().profile?.preferences)
        return useCardioStore.getState().add({
          activity: live.activity,
          startedAt: new Date(live.startedAt),
          duration,
          distance: null,
          calories: null,
          avgHeartRate: bpms.length ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : null,
          maxHeartRate: bpms.length ? Math.max(...bpms) : null,
          zones: maxHr && samples.length ? timeInZones(samples, maxHr, end) : null,
          effort: null,
          source: 'manual',
          externalId: null,
          sourceName: 'WorkoutPro (ao vivo)',
          notes: '',
        })
      },

      discard: () => set({ live: null }),
    }),
    {
      name: 'workoutpro-live-cardio',
      version: 1,
      partialize: (state) => ({ live: state.live }),
    }
  )
)
