'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useHealthStore } from '@/stores/useHealthStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import {
  buildWidgetPayload, createChangePusher, lastWorkoutShortcut,
  type LastWorkoutShortcut, type WidgetPayload,
} from '@/lib/widgetSync'

function isAndroid() {
  return import('@capacitor/core').then(({ Capacitor }) => Capacitor.getPlatform() === 'android').catch(() => false)
}

/**
 * Keeps the Android home-screen widget and the "Repetir treino" shortcut in step with the
 * schedule, streak and last heart rate. The running workout / rest is pushed to the widget
 * by the native timer service itself.
 */
export function WidgetSync() {
  const workouts = useWorkoutStore((state) => state.workouts)
  const workoutsLoaded = useWorkoutStore((state) => state.loaded)
  const profile = useProfileStore((state) => state.profile)
  const sessions = useProfileStore((state) => state.sessions)
  const profileLoaded = useProfileStore((state) => state.loaded)
  const heartToday = useHealthStore((state) => state.heartToday)

  const pushers = useRef<{
    widget: ReturnType<typeof createChangePusher<WidgetPayload>>
    shortcut: ReturnType<typeof createChangePusher<LastWorkoutShortcut | null>>
  } | null>(null)

  useEffect(() => {
    const widget = createChangePusher<WidgetPayload>(async (payload) => {
      if (!(await isAndroid())) return
      const { WorkoutWidget } = await import('@/lib/widgetPlugin')
      await WorkoutWidget.update(payload)
    })
    const shortcut = createChangePusher<LastWorkoutShortcut | null>(async (value) => {
      if (!(await isAndroid())) return
      const { WorkoutWidget } = await import('@/lib/widgetPlugin')
      await WorkoutWidget.setLastWorkout(value ?? { id: '', name: '' })
    }, 3000)
    pushers.current = { widget, shortcut }
    // Leaving the app: send what is pending right away, JS may be paused afterwards.
    const onHidden = () => {
      if (document.visibilityState !== 'hidden') return
      widget.flush()
      shortcut.flush()
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      widget.flush()
      shortcut.flush()
      pushers.current = null
    }
  }, [])

  const ready = workoutsLoaded && profileLoaded
  const payload = useMemo(
    () => ready ? buildWidgetPayload({ workouts, profile, heartToday }) : null,
    [heartToday, profile, ready, workouts]
  )
  const last = useMemo(() => ready ? lastWorkoutShortcut(sessions, workouts) : undefined, [ready, sessions, workouts])

  useEffect(() => {
    if (payload) pushers.current?.widget.push(payload)
  }, [payload])

  useEffect(() => {
    if (last !== undefined) pushers.current?.shortcut.push(last)
  }, [last])

  return null
}
