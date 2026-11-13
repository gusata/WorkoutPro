import { registerPlugin } from '@capacitor/core'

interface TimerPluginInterface {
  startWorkout(options: { workoutStartedAt: number }): Promise<void>
  stopWorkout(): Promise<void>
  startTimer(options: { seconds: number; workoutStartedAt: number }): Promise<void>
  stopTimer(): Promise<void>
  updateStatus(options: { workoutName: string; current: string; next: string; doneSets: number; totalSets: number }): Promise<void>
}

export const TimerPlugin = registerPlugin<TimerPluginInterface>('TimerPlugin', {
  web: {
    async startWorkout() {},
    async stopWorkout() {},
    async startTimer() {},
    async stopTimer() {},
    async updateStatus() {},
  },
})
