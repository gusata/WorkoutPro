'use client'

import { useEffect } from 'react'
import { createActionDrainer } from '@/lib/notificationActions'
import { useSessionStore } from '@/stores/useSessionStore'
import { useTimerStore } from '@/stores/useTimerStore'

/**
 * Applies the timer notification buttons ("+15 s", "Pular descanso", "Série feita") to the
 * session and timer stores. The service already acted on them natively; this keeps the app
 * consistent, including taps made while the WebView was paused (queued natively).
 */
export function NotificationActionSync() {
  useEffect(() => {
    let disposed = false
    let removeListener: (() => void) | undefined
    let onVisible: (() => void) | undefined

    import('@capacitor/core')
      .then(async ({ Capacitor }) => {
        if (disposed || Capacitor.getPlatform() !== 'android') return
        const { TimerPlugin } = await import('@/lib/timerPlugin')
        const drain = createActionDrainer(() => TimerPlugin.consumePendingActions(), {
          getActive: () => useSessionStore.getState().active,
          completeSet: (exerciseId, setId) => useSessionStore.getState().completeSet(exerciseId, setId),
          updateSet: (exerciseId, setId, updates) => useSessionStore.getState().updateSet(exerciseId, setId, updates),
          syncRest: (endAt, total) => useTimerStore.getState().syncRestFromNative(endAt, total),
        })
        const run = () => { void drain().catch(() => undefined) }
        const handle = await TimerPlugin.addListener('notificationAction', run)
        if (disposed) { void handle.remove(); return }
        removeListener = () => { void handle.remove() }
        onVisible = () => { if (document.visibilityState === 'visible') run() }
        document.addEventListener('visibilitychange', onVisible)
        run()
      })
      .catch(() => undefined)

    return () => {
      disposed = true
      removeListener?.()
      if (onVisible) document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return null
}
