import { registerPlugin } from '@capacitor/core'
import type { LastWorkoutShortcut, WidgetPayload } from '@/lib/widgetSync'

interface WorkoutWidgetPlugin {
  /** Stores the snapshot natively and redraws the home-screen widgets. */
  update(payload: WidgetPayload): Promise<void>
  /** Publishes the "Repetir <treino>" launcher shortcut; an empty id removes it. */
  setLastWorkout(shortcut: LastWorkoutShortcut | { id: ''; name: '' }): Promise<void>
}

export const WorkoutWidget = registerPlugin<WorkoutWidgetPlugin>('WorkoutWidget', {
  web: {
    async update() {},
    async setLastWorkout() {},
  },
})
