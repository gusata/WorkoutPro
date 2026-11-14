'use client'

import { useEffect } from 'react'
import { useProfileStore } from '@/stores/useProfileStore'
import { CHANGES_INTERVAL_MS, useHealthStore } from '@/stores/useHealthStore'

/**
 * Keeps health data current while the app is open: asks Health Connect what changed
 * on start, when the app returns to the foreground and every few seconds while it is
 * visible. A check with no news is a single cheap local call (see HealthChangesPlugin).
 */
export function HealthSync() {
  const loaded = useProfileStore((state) => state.loaded)
  const healthSync = useProfileStore((state) => state.profile?.preferences?.healthSync ?? false)

  useEffect(() => {
    if (!loaded || !healthSync) return
    const check = () => {
      if (document.visibilityState === 'visible') void useHealthStore.getState().checkChanges()
    }
    const first = setTimeout(check, 1200)
    const timer = setInterval(check, CHANGES_INTERVAL_MS)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [healthSync, loaded])

  return null
}
