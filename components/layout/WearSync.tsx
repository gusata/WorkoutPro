'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSessionStore } from '@/stores/useSessionStore'
import { useTimerStore } from '@/stores/useTimerStore'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { useProfileStore } from '@/stores/useProfileStore'
import type { WearBridgeDeps } from '@/lib/wearBridge'

/** Builds the bridge dependencies from the real stores. */
export function createStoreDeps(navigate: (path: string) => void): WearBridgeDeps {
  return {
    getActive: () => useSessionStore.getState().active,
    getTimer: () => {
      const { restRunning, restEndAt, restTotal } = useTimerStore.getState()
      return { restRunning, restEndAt, restTotal }
    },
    updateSet: (exerciseId, setId, updates) => useSessionStore.getState().updateSet(exerciseId, setId, updates),
    completeSet: (exerciseId, setId) => useSessionStore.getState().completeSet(exerciseId, setId),
    startRest: (seconds) => useTimerStore.getState().startRest(seconds),
    extendRest: (seconds) => useTimerStore.getState().extendRest(seconds),
    stopRest: () => useTimerStore.getState().stopRest(),
    startTodaysWorkout: async () => {
      const { pickTodaysWorkout } = await import('@/lib/wearBridge')
      const workouts = useWorkoutStore.getState()
      if (!workouts.loaded) await workouts.load()
      const profile = useProfileStore.getState()
      if (!profile.loaded) await profile.load()
      const { workouts: list, exercises } = useWorkoutStore.getState()
      const picked = pickTodaysWorkout(list, exercises, useProfileStore.getState().sessions)
      if (!picked || useSessionStore.getState().active) return false
      await useSessionStore.getState().startSession(picked.workout, picked.exercises)
      navigate('/workouts/execute')
      return true
    },
    finishSession: async () => {
      const session = await useSessionStore.getState().endSession()
      // The execute page notices the session is gone and leaves on its own.
      if (session) await useProfileStore.getState().load()
    },
  }
}

/** Keeps the Wear OS companion in sync with the active session (Android only; no-op elsewhere). */
export function WearSync() {
  const router = useRouter()
  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router }, [router])

  useEffect(() => {
    let stop: (() => void) | undefined
    let cancelled = false
    void (async () => {
      const { Capacitor } = await import('@capacitor/core')
      if (cancelled || Capacitor.getPlatform() !== 'android') return
      const [{ startWearBridge }, { WearBridgePlugin }] = await Promise.all([
        import('@/lib/wearBridge'),
        import('@/lib/wearPlugin'),
      ])
      if (cancelled) return
      const bridge = startWearBridge({
        plugin: WearBridgePlugin,
        deps: createStoreDeps((path) => routerRef.current.push(path)),
        subscribe: (onChange) => {
          const offSession = useSessionStore.subscribe((state, previous) => { if (state.active !== previous.active) onChange() })
          const offTimer = useTimerStore.subscribe((state, previous) => {
            // restSeconds ticks every second; only the end time matters to the watch.
            if (state.restRunning !== previous.restRunning || state.restEndAt !== previous.restEndAt) onChange()
          })
          return () => { offSession(); offTimer() }
        },
      })
      stop = bridge.stop
    })().catch(() => undefined)
    return () => { cancelled = true; stop?.() }
  }, [])

  return null
}
