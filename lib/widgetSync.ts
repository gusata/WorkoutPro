import { format } from 'date-fns'
import type { HeartToday } from '@/lib/health'
import type { UserProfile, Workout, WorkoutSession } from '@/types'

/**
 * Snapshot for the Android home-screen widget (WorkoutWidgetProvider). The native side
 * picks today's entry from `schedule` and expires the streak by itself, so the widget
 * stays right after midnight even if the app is not opened.
 */
export interface WidgetPayload {
  /** Index = JS weekday (0 = Sunday). */
  schedule: Array<Array<{ id: string; name: string }>>
  streak: number
  /** Local day (yyyy-MM-dd) of the last finished workout. */
  lastWorkoutDay: string | null
  heartRate: { bpm: number; time: number } | null
}

export interface LastWorkoutShortcut {
  id: string
  name: string
}

export function buildWidgetPayload(input: {
  workouts: Workout[]
  profile: Pick<UserProfile, 'streak' | 'lastWorkoutDate'> | null
  heartToday: HeartToday | null
}): WidgetPayload {
  const schedule = Array.from({ length: 7 }, (_, weekday) => input.workouts
    .filter((workout) => workout.scheduledWeekdays?.includes(weekday))
    .map((workout) => ({ id: workout.id, name: workout.name })))
  const last = input.profile?.lastWorkoutDate ? new Date(input.profile.lastWorkoutDate) : null
  const latest = input.heartToday?.latest ?? null
  return {
    schedule,
    streak: Math.max(0, input.profile?.streak ?? 0),
    lastWorkoutDay: last && !Number.isNaN(last.getTime()) ? format(last, 'yyyy-MM-dd') : null,
    heartRate: latest && latest.bpm > 0 ? { bpm: Math.round(latest.bpm), time: new Date(latest.time).getTime() } : null,
  }
}

/** The most recently finished workout that still exists (for the "Repetir" launcher shortcut). */
export function lastWorkoutShortcut(sessions: WorkoutSession[], workouts: Workout[]): LastWorkoutShortcut | null {
  const byId = new Map(workouts.map((workout) => [workout.id, workout]))
  let best: { time: number; workout: Workout } | null = null
  for (const session of sessions) {
    if (!session.finishedAt) continue
    const workout = byId.get(session.workoutId)
    if (!workout) continue
    const time = new Date(session.finishedAt).getTime()
    if (!best || time > best.time) best = { time, workout }
  }
  return best ? { id: best.workout.id, name: best.workout.name } : null
}

/**
 * Debounced sender that skips values identical to the last one sent: the stores change
 * often (every set, every heart-rate poll) but the widget only needs real changes.
 */
export function createChangePusher<T>(send: (value: T) => Promise<unknown> | unknown, delay = 1500) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: { value: T; key: string } | null = null
  let lastSent: string | null = null

  function flush() {
    if (timer) clearTimeout(timer)
    timer = undefined
    const next = pending
    pending = null
    if (!next || next.key === lastSent) return
    lastSent = next.key
    Promise.resolve()
      .then(() => send(next.value))
      // Send again next time if the native call failed.
      .catch(() => { if (lastSent === next.key) lastSent = null })
  }

  return {
    push(value: T) {
      const key = JSON.stringify(value)
      if (key === lastSent && !pending) return
      pending = { value, key }
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, delay)
    },
    flush,
    cancel() {
      if (timer) clearTimeout(timer)
      timer = undefined
      pending = null
    },
  }
}
