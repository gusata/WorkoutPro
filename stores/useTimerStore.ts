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
  startWorkoutTimer: (startedAt?: number) => void
  stopWorkoutTimer: () => void
  resetWorkoutTimer: () => void
  startRest: (seconds: number) => void
  /** Adds (or removes, when negative) time to the running rest without restarting it. */
  extendRest: (seconds: number) => void
  stopRest: () => void
  /**
   * Mirrors a rest changed by a notification button (already applied natively, which also
   * owns its end alert): updates the state without calling the native timer again.
   */
  syncRestFromNative: (endAt: number | null, total?: number) => void
  tickWorkout: () => void
  tickRest: () => void
}

// Dynamic imports so @capacitor/core is never evaluated at module level.
// This prevents crashes in Turbopack dev mode and avoids SSR side-effects.

function reportNativeError(message: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('workoutpro:native-error', { detail: message }))
  }
}

function fireStartWorkout(workoutStartedAt: number) {
  if (typeof window === 'undefined') return
  import('@/lib/timerPlugin')
    .then(({ TimerPlugin }) => TimerPlugin.startWorkout({ workoutStartedAt }))
    .catch(() => reportNativeError('O timer nativo nao iniciou. O cronometro do app continua funcionando.'))
}

function fireStopWorkout() {
  if (typeof window === 'undefined') return
  import('@/lib/timerPlugin')
    .then(({ TimerPlugin }) => TimerPlugin.stopWorkout())
    .catch(() => reportNativeError('O servico nativo do timer nao pode ser encerrado.'))
}

function fireStartRest(seconds: number, workoutStartedAt: number) {
  if (typeof window === 'undefined') return
  import('@/lib/notifications')
    .then(({ scheduleRestEndNotification }) => scheduleRestEndNotification(seconds))
    .catch(() => reportNativeError('Nao foi possivel agendar o aviso de descanso.'))
  import('@/lib/timerPlugin')
    .then(({ TimerPlugin }) => TimerPlugin.startTimer({ seconds, workoutStartedAt }))
    .catch(() => reportNativeError('O descanso nao apareceu na notificacao do sistema.'))
}

// Called only when the user MANUALLY cancels rest (X button).
// Cancels the scheduled notification so it doesn't fire after the user dismissed it.
// Sends ACTION_CANCEL_REST to the service — keeps it running for the workout timer.
function fireCancelRest() {
  if (typeof window === 'undefined') return
  import('@/lib/notifications')
    .then(({ cancelRestNotification }) => cancelRestNotification())
    .catch(() => reportNativeError('Nao foi possivel cancelar o aviso de descanso.'))
  import('@/lib/timerPlugin')
    .then(({ TimerPlugin }) => TimerPlugin.stopTimer())
    .catch(() => reportNativeError('Nao foi possivel atualizar o servico nativo de descanso.'))
}

export const useTimerStore = create<TimerStore>((set, get) => ({
  workoutSeconds: 0,
  workoutRunning: false,
  workoutStartedAt: null,
  restSeconds: 0,
  restTotal: 0,
  restRunning: false,
  restEndAt: null,

  startWorkoutTimer: (requestedStartedAt) => {
    // Only record the start time once — don't reset if already running.
    const existing = get().workoutStartedAt
    const startedAt = requestedStartedAt ?? existing ?? Date.now()
    set({
      workoutRunning: true,
      workoutStartedAt: startedAt,
      workoutSeconds: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
    })
    // Start the foreground service notification on first call only.
    if (!existing || existing !== startedAt) fireStartWorkout(startedAt)
  },

  stopWorkoutTimer: () => set({ workoutRunning: false }),

  resetWorkoutTimer: () => {
    set({
      workoutSeconds: 0,
      workoutRunning: false,
      workoutStartedAt: null,
      restSeconds: 0,
      restTotal: 0,
      restRunning: false,
      restEndAt: null,
    })
    fireCancelRest()
    fireStopWorkout()
  },

  startRest: (seconds) => {
    const workoutStartedAt = get().workoutStartedAt ?? Date.now()
    const endAt = Date.now() + seconds * 1000
    set({ restSeconds: seconds, restTotal: seconds, restRunning: true, restEndAt: endAt })
    fireStartRest(seconds, workoutStartedAt)
  },

  extendRest: (extra) => {
    const { restRunning, restEndAt, restTotal, workoutStartedAt } = get()
    if (!restRunning || restEndAt == null) return
    const endAt = Math.max(Date.now() + 1000, restEndAt + extra * 1000)
    const remaining = Math.ceil((endAt - Date.now()) / 1000)
    set({ restEndAt: endAt, restSeconds: remaining, restTotal: Math.max(remaining, restTotal + extra) })
    // Re-schedules the end-of-rest alarm and the native notification countdown.
    fireStartRest(remaining, workoutStartedAt ?? Date.now())
  },

  // Manual cancel — cancel the alarm notification and tell the service to drop the rest display.
  stopRest: () => {
    set({ restRunning: false, restSeconds: 0, restEndAt: null })
    fireCancelRest()
  },

  syncRestFromNative: (endAt, total) => {
    // The native service alerts at the (new) end; a previously scheduled JS alert would be stale.
    if (typeof window !== 'undefined') {
      import('@/lib/notifications')
        .then(({ cancelRestNotification }) => cancelRestNotification())
        .catch(() => undefined)
    }
    const remaining = endAt == null ? 0 : Math.ceil((endAt - Date.now()) / 1000)
    if (endAt == null || remaining <= 0) {
      set({ restRunning: false, restSeconds: 0, restEndAt: null })
      return
    }
    set((state) => ({
      restRunning: true,
      restEndAt: endAt,
      restSeconds: remaining,
      restTotal: Math.max(remaining, total ?? state.restTotal),
    }))
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
