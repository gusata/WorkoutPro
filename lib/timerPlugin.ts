import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'

/** A set still to do, in order; the notification's "Série feita" button completes the first one. */
export interface LivePendingStep {
  exerciseId: string
  setId: string
  restSeconds: number
  label: string
}

export interface LiveStatus {
  workoutName: string
  current: string
  next: string
  doneSets: number
  totalSets: number
  pending?: LivePendingStep[]
}

/** A notification button handled natively (TimerForegroundService) while JS may have been paused. */
export type NotificationAction =
  | { id: string; at: number; workoutStartedAt: number; type: 'completeSet'; exerciseId: string; setId: string; restEndAt?: number; restTotal?: number }
  | { id: string; at: number; workoutStartedAt: number; type: 'extendRest'; restEndAt: number; restTotal: number }
  | { id: string; at: number; workoutStartedAt: number; type: 'skipRest' }

interface TimerPluginInterface {
  startWorkout(options: { workoutStartedAt: number }): Promise<void>
  stopWorkout(): Promise<void>
  startTimer(options: { seconds: number; workoutStartedAt: number }): Promise<void>
  stopTimer(): Promise<void>
  updateStatus(options: LiveStatus): Promise<void>
  /** Returns and clears the queued notification actions. */
  consumePendingActions(): Promise<{ actions: NotificationAction[] }>
  /** Fired after each notification button (or on resume when actions are queued); drain the queue. */
  addListener(eventName: 'notificationAction', listener: (event: { type: string }) => void): Promise<PluginListenerHandle>
}

export const TimerPlugin = registerPlugin<TimerPluginInterface>('TimerPlugin', {
  web: {
    async startWorkout() {},
    async stopWorkout() {},
    async startTimer() {},
    async stopTimer() {},
    async updateStatus() {},
    async consumePendingActions() { return { actions: [] } },
    async addListener() { return { remove: async () => {} } },
  },
})
