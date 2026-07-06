'use client'

import { create } from 'zustand'

interface TimerStore {
  workoutSeconds: number
  workoutRunning: boolean
  workoutStartedAt: number | null
  restSeconds: number
  restTotal: number
  restRunning: boolean
  restEndAt: number | null
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

function fireStartWorkout(workoutStartedAt: number) {
  if (typeof window === 'undefined') return
  import('@/lib/timerPlugin')
    .then(({ TimerPlugin }) => TimerPlugin.startWorkout({ workoutStartedAt }))
    .catch(() => {})
}

function fireStopWorkout() {
  if (typeof window === 'undefined') return
  import('@/lib/timerPlugin')
    .then(({ TimerPlugin }) => TimerPlugin.stopWorkout())
    .catch(() => {})
}

function fireStartRest(seconds: number, workoutStartedAt: number) {
  if (typeof window === 'undefined') return
  import('@/lib/notifications')
    .then(({ scheduleRestEndNotification }) => scheduleRestEndNotification(seconds))
    .catch(() => {})
  import('@/lib/timerPlugin')
    .then(({ TimerPlugin }) => TimerPlugin.startTimer({ seconds, workoutStartedAt }))
    .catch(() => {})
}

// Called only when the user MANUALLY cancels rest (X button).
// Cancels the scheduled notification so it doesn't fire after the user dismissed it.
// Sends ACTION_CANCEL_REST to the service — keeps it running for the workout timer.
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
  workoutStartedAt: null,
  restSeconds: 0,
  restTotal: 0,
  restRunning: false,
  restEndAt: null,

  startWorkoutTimer: () => {
    // Only record the start time once — don't reset if already running.
    const existing = get().workoutStartedAt
    const startedAt = existing ?? Date.now()
    set({ workoutRunning: true, workoutStartedAt: startedAt })
    // Start the foreground service notification on first call only.
    if (!existing) fireStartWorkout(startedAt)
  },

  stopWorkoutTimer: () => set({ workoutRunning: false }),

  resetWorkoutTimer: () => {
    set({ workoutSeconds: 0, workoutRunning: false, workoutStartedAt: null })
    fireStopWorkout()
  },

  startRest: (seconds) => {
    const workoutStartedAt = get().workoutStartedAt ?? Date.now()
    const endAt = Date.now() + seconds * 1000
    set({ restSeconds: seconds, restTotal: seconds, restRunning: true, restEndAt: endAt })
    fireStartRest(seconds, workoutStartedAt)
  },

  // Manual cancel — cancel the alarm notification and tell the service to drop the rest display.
  stopRest: () => {
    set({ restRunning: false, restSeconds: 0, restEndAt: null })
    fireCancelRest()
  },

  // Use wall-clock so the timer stays accurate after backgrounding.
  // The setInterval may be throttled/paused by Android; Date.now() is always correct.
  tickWorkout: () => {
    const { workoutRunning, workoutStartedAt } = get()
    if (workoutRunning && workoutStartedAt != null) {
      set({ workoutSeconds: Math.floor((Date.now() - workoutStartedAt) / 1000) })
    }
  },

  tickRest: () => {
    const { restRunning, restEndAt } = get()
    if (restRunning && restEndAt != null) {
      const remaining = Math.ceil((restEndAt - Date.now()) / 1000)
      if (remaining <= 0) {
        set({ restRunning: false, restSeconds: 0, restEndAt: null })
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
        set({ restSeconds: remaining })
      }
    }
  },
}))
