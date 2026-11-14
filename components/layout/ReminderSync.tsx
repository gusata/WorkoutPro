'use client'

import { useEffect } from 'react'
import { useProfileStore } from '@/stores/useProfileStore'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { syncReminders } from '@/lib/reminders'

/** Keeps the native weekly reminders in step with the workout schedule and the reminder settings. */
export function ReminderSync() {
  const reminders = useProfileStore((state) => state.profile?.preferences?.reminders)
  const sessionsLoaded = useProfileStore((state) => state.loaded)
  const workouts = useWorkoutStore((state) => state.workouts)
  const workoutsLoaded = useWorkoutStore((state) => state.loaded)
  // Only re-schedule when something that affects the reminders changes.
  const scheduleKey = workouts.map((workout) => `${workout.id}:${workout.name}:${(workout.scheduledWeekdays ?? []).join(',')}`).join('|')

  useEffect(() => {
    if (!sessionsLoaded || !workoutsLoaded) return
    const timer = setTimeout(() => {
      void syncReminders(useWorkoutStore.getState().workouts, reminders, useProfileStore.getState().sessions).catch(() => undefined)
    }, 800)
    return () => clearTimeout(timer)
  }, [reminders, scheduleKey, sessionsLoaded, workoutsLoaded])

  return null
}
