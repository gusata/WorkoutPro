'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CARDIO_NEW_EVENT, parseAppLink, pickWorkoutToStart, type AppLink } from '@/lib/deepLinks'
import { useProfileStore } from '@/stores/useProfileStore'
import { useSessionStore } from '@/stores/useSessionStore'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import type { Exercise } from '@/types'

/** The launch URL stays the same for the whole process; handle it once per page load. */
let launchHandled = false
/** The launch URL can also arrive as a (retained) appUrlOpen event. */
let lastHandled: { url: string; at: number } | null = null
const DUPLICATE_MS = 3000

function waitForData(timeoutMs = 10_000): Promise<boolean> {
  const loaded = () => useWorkoutStore.getState().loaded && useProfileStore.getState().loaded
  if (loaded()) return Promise.resolve(true)
  return new Promise((resolve) => {
    const stop = () => { unsubWorkouts(); unsubProfile(); clearTimeout(timer) }
    const check = () => { if (loaded()) { stop(); resolve(true) } }
    const unsubWorkouts = useWorkoutStore.subscribe(check)
    const unsubProfile = useProfileStore.subscribe(check)
    const timer = setTimeout(() => { stop(); resolve(false) }, timeoutMs)
  })
}

/** Routes workoutpro://open/... links from the widget, launcher shortcuts and notifications. */
export function DeepLinkHandler() {
  const router = useRouter()
  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router }, [router])

  useEffect(() => {
    let disposed = false
    let removeListener: (() => void) | undefined

    async function open(link: AppLink) {
      const go = (path: string) => routerRef.current.push(path)
      if (link.kind === 'route') return go(link.path)
      if (link.kind === 'cardio-new') {
        if (window.location.pathname.startsWith('/cardio')) window.dispatchEvent(new Event(CARDIO_NEW_EVENT))
        else go('/cardio?novo=1')
        return
      }
      // "Iniciar": continue a running session instead of replacing it.
      if (useSessionStore.getState().active) return go('/workouts/execute')
      if (!(await waitForData())) return go('/dashboard')
      if (useSessionStore.getState().active) return go('/workouts/execute')
      const { workouts, exercises } = useWorkoutStore.getState()
      const workout = pickWorkoutToStart(workouts, useProfileStore.getState().sessions, new Date(), link.workoutId)
      if (!workout) return go(link.workoutId ? '/workouts' : '/dashboard')
      const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]))
      const list = workout.exerciseIds.map((id) => byId.get(id)).filter((item): item is Exercise => Boolean(item))
      await useSessionStore.getState().startSession(workout, list)
      go('/workouts/execute')
    }

    function handle(url: string | undefined | null) {
      if (!url || disposed) return
      const now = Date.now()
      if (lastHandled && lastHandled.url === url && now - lastHandled.at < DUPLICATE_MS) return
      const link = parseAppLink(url)
      if (!link) return
      lastHandled = { url, at: now }
      void open(link).catch(() => routerRef.current.push('/dashboard'))
    }

    import('@capacitor/core')
      .then(async ({ Capacitor }) => {
        if (disposed || !Capacitor.isNativePlatform()) return
        const { App } = await import('@capacitor/app')
        const listener = await App.addListener('appUrlOpen', ({ url }) => handle(url))
        if (disposed) { void listener.remove(); return }
        removeListener = () => { void listener.remove() }
        if (!launchHandled) {
          launchHandled = true
          const launch = await App.getLaunchUrl().catch(() => undefined)
          handle(launch?.url)
        }
      })
      .catch(() => undefined)

    return () => {
      disposed = true
      removeListener?.()
    }
  }, [])

  return null
}
