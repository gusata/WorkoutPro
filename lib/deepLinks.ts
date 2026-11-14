import { isSameDay } from 'date-fns'
import type { Workout, WorkoutSession } from '@/types'

/**
 * workoutpro://open/... links used by the Android widget, launcher shortcuts and
 * notifications (see android/.../DeepLinks.java). workoutpro://auth/callback stays with
 * the login flow and is ignored here.
 */
export type AppLink =
  | { kind: 'route'; path: string }
  | { kind: 'start'; workoutId: string | null }
  | { kind: 'cardio-new' }

export const CARDIO_NEW_EVENT = 'workoutpro:cardio-new'

const ROUTES: Record<string, string> = {
  '': '/dashboard',
  dashboard: '/dashboard',
  workout: '/workouts/execute',
  progress: '/stats',
  cardio: '/cardio',
  health: '/health',
}

/** Parsed by hand: older Android WebViews don't give custom-scheme URLs a host. */
export function parseAppLink(url: string): AppLink | null {
  const match = /^workoutpro:\/\/open(?:\/([^?#]*))?(?:\?([^#]*))?/i.exec(url.trim())
  if (!match) return null
  const path = (match[1] ?? '').replace(/\/+$/, '').toLowerCase()
  const query = new URLSearchParams(match[2] ?? '')
  if (path === 'start') {
    const workoutId = query.get('workout')
    return { kind: 'start', workoutId: workoutId ? workoutId : null }
  }
  if (path === 'cardio' && query.get('novo') === '1') return { kind: 'cardio-new' }
  // Unknown paths (e.g. from a newer app version) still open the app on the dashboard.
  return { kind: 'route', path: ROUTES[path] ?? '/dashboard' }
}

/**
 * Workout for "Iniciar treino de hoje": the one asked for, or one scheduled for today
 * that wasn't finished yet today. Null when nothing fits (the dashboard suggests one).
 */
export function pickWorkoutToStart(
  workouts: Workout[],
  sessions: WorkoutSession[],
  now: Date,
  workoutId: string | null,
): Workout | null {
  if (workoutId) return workouts.find((workout) => workout.id === workoutId) ?? null
  const doneToday = new Set(sessions
    .filter((session) => session.finishedAt && isSameDay(new Date(session.finishedAt), now))
    .map((session) => session.workoutId))
  return workouts.find((workout) =>
    workout.scheduledWeekdays?.includes(now.getDay()) && !doneToday.has(workout.id)
  ) ?? null
}
