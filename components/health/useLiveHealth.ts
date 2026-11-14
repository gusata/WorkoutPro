'use client'

import { useEffect } from 'react'
import { LIVE_INTERVAL_MS, useHealthStore } from '@/stores/useHealthStore'
import { useProfileStore } from '@/stores/useProfileStore'

/**
 * While the screen is open and visible, re-reads today's heart rate and steps every
 * minute. Health Connect has no change notifications for third-party apps, so polling
 * is the only way to pick up a new watch measurement.
 */
export function useLiveHealth() {
  const healthSync = useProfileStore((state) => state.profile?.preferences?.healthSync ?? false)

  useEffect(() => {
    if (!healthSync) return
    const tick = () => {
      if (document.visibilityState === 'visible') void useHealthStore.getState().refreshLive()
    }
    const timer = setInterval(tick, LIVE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [healthSync])
}
