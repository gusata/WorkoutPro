import { registerPlugin } from '@capacitor/core'

interface TimerPluginInterface {
  startTimer(options: { seconds: number }): Promise<void>
  stopTimer(): Promise<void>
}

export const TimerPlugin = registerPlugin<TimerPluginInterface>('TimerPlugin', {
  web: {
    async startTimer() {},
    async stopTimer() {},
  },
})
