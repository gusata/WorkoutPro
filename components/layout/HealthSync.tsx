'use client'

import { useEffect } from 'react'
import { useProfileStore } from '@/stores/useProfileStore'
import { useHealthStore } from '@/stores/useHealthStore'

/** Refreshes health data on start and when the app returns to the foreground (throttled in the store). */
export function HealthSync() {
  const loaded = useProfileStore((state) => state.loaded)
  const healthSync = useProfileStore((state) => state.profile?.preferences?.healthSync ?? false)

  useEffect(() => {
    if (!loaded || !healthSync) return
    const run = () => { void useHealthStore.getState().refresh() }
    const timer = setTimeout(run, 1200)
    const onVisible = () => { if (document.visibilityState === 'visible') run() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [healthSync, loaded])

  return null
}
