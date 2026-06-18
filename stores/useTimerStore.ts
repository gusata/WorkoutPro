'use client'

import { create } from 'zustand'

interface TimerStore {
  workoutSeconds: number
  workoutRunning: boolean
  restSeconds: number
  restTotal: number
  restRunning: boolean
  startWorkoutTimer: () => void
  stopWorkoutTimer: () => void
  resetWorkoutTimer: () => void
  startRest: (seconds: number) => void
  stopRest: () => void
  tickWorkout: () => void
  tickRest: () => void
}

// Dynamic imports so @capacitor/core is never evaluated at module level.
// This prevents crashes in Turbopack dev mode and avoids SSR side-effects.

function fireStartRest(seconds: number) {
  if (typeof window === 'undefined') return
  import('@/lib/notifications')
    .then(({ scheduleRestEndNotification }) => scheduleRestEndNotification(seconds))
    .catch(() => {})
  import('@/lib/timerPlugin')
    .then(({ TimerPlugin }) => TimerPlugin.startTimer({ seconds }))
    .catch(() => {})
}

// Called only when the user MANUALLY cancels rest (X button).
// Cancels the scheduled notification so it doesn't fire after the user dismissed it.
// Also stops the foreground service countdown.
function fireCancelRest() {
  if (typeof window === 'undefined') return
  import('@/lib/notifications')
    .then(({ cancelRestNotification }) => cancelRestNotification())
    .catch(() => {})
  import('@/lib/timerPlugin')
    .then(({ TimerPlugin }) => TimerPlugin.stopTimer())
    .catch(() => {})
}

export const useTimerStore = create<TimerStore>((set, get) => ({
  workoutSeconds: 0,
  workoutRunning: false,
  restSeconds: 0,
  restTotal: 0,
  restRunning: false,

  startWorkoutTimer: () => set({ workoutRunning: true }),
  stopWorkoutTimer: () => set({ workoutRunning: false }),
  resetWorkoutTimer: () => set({ workoutSeconds: 0, workoutRunning: false }),

  startRest: (seconds) => {
    set({ restSeconds: seconds, restTotal: seconds, restRunning: true })
    fireStartRest(seconds)
  },

  // Manual cancel — dismiss the notification and stop the foreground service.
  stopRest: () => {
    set({ restRunning: false, restSeconds: 0 })
    fireCancelRest()
  },

  tickWorkout: () => {
    if (get().workoutRunning) {
      set((s) => ({ workoutSeconds: s.workoutSeconds + 1 }))
    }
  },

  // Natural timer completion — do NOT cancel the notification here.
  // The @capacitor/local-notifications alarm fires at its scheduled time,
  // and the foreground service's own onTimerComplete() handles stopping the service.
  tickRest: () => {
    if (get().restRunning) {
      const next = get().restSeconds - 1
      if (next <= 0) {
        set({ restRunning: false, restSeconds: 0 })
        // Web fallback feedback
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([200, 100, 200, 100, 200])
        }
        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          new Notification('Descanso terminado!', { body: 'Hora da próxima série 💪' })
        }
      } else {
        set({ restSeconds: next })
      }
    }
  },
}))
