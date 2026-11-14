import { Capacitor } from '@capacitor/core'
import { ALERT_CHANNEL_ID, ensureAlertChannel } from '@/lib/notifications'
import type { ReminderPreferences, Workout, WorkoutSession } from '@/types'

const REMINDER_BASE_ID = 3000
/** Fired on window after every native re-schedule, with `detail: { scheduled }`. */
export const REMINDERS_SYNCED_EVENT = 'workoutpro:reminders-synced'
const DEFAULT_TIME = 18 * 60
/** Reminders fire a little before the usual training time. */
const LEAD_MINUTES = 30

/** Median start time (minutes after midnight) of the last 20 finished sessions. */
export function usualTrainingTime(sessions: WorkoutSession[]): number | null {
  const minutes = sessions
    .filter((session) => session.finishedAt)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, 20)
    .map((session) => {
      const date = new Date(session.startedAt)
      return date.getHours() * 60 + date.getMinutes()
    })
    .sort((a, b) => a - b)
  if (minutes.length < 3) return null
  const middle = Math.floor(minutes.length / 2)
  const median = minutes.length % 2 ? minutes[middle] : Math.round((minutes[middle - 1] + minutes[middle]) / 2)
  return Math.round(median / 5) * 5
}

export function reminderTime(preferences: ReminderPreferences | undefined, sessions: WorkoutSession[]): number {
  if (preferences?.timeOfDay != null) return preferences.timeOfDay
  const usual = usualTrainingTime(sessions)
  return Math.max(6 * 60, (usual ?? DEFAULT_TIME) - LEAD_MINUTES)
}

export function formatTimeOfDay(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/** Workouts planned for a JS weekday (0 = Sunday). */
export function workoutsForWeekday(workouts: Workout[], weekday: number) {
  return workouts.filter((workout) => workout.scheduledWeekdays?.includes(weekday))
}

export function reminderMessage(names: string[]) {
  if (names.length === 0) return null
  if (names.length === 1) return `Hoje é dia de ${names[0]}`
  return `Hoje é dia de ${names.slice(0, -1).join(', ')} e ${names.at(-1)}`
}

/** Weekly reminder notifications use ids 3000..3006 (one per weekday). */
export function isReminderId(id: number) {
  return Number.isInteger(id) && id >= REMINDER_BASE_ID && id < REMINDER_BASE_ID + 7
}

export function countReminderNotifications(notifications: { id: number }[]) {
  return notifications.filter((notification) => isReminderId(notification.id)).length
}

export function scheduledRemindersLabel(count: number) {
  if (count === 0) return 'Nenhum lembrete agendado neste aparelho.'
  return `${count} ${count === 1 ? 'lembrete semanal agendado' : 'lembretes semanais agendados'} neste aparelho.`
}

/** How many weekly reminders the OS actually holds (null on the web / when it can't be read). */
export async function pendingReminderCount(): Promise<number | null> {
  if (!remindersSupported()) return null
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const { notifications } = await LocalNotifications.getPending()
    return countReminderNotifications(notifications)
  } catch {
    return null
  }
}

function announceSync(scheduled: number) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(REMINDERS_SYNCED_EVENT, { detail: { scheduled } }))
}

export function remindersSupported() {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform()
}

/**
 * Re-creates the weekly repeating reminders from the workouts' schedule.
 * Only native builds can schedule; the web app shows an in-app banner instead.
 */
export async function syncReminders(
  workouts: Workout[],
  preferences: ReminderPreferences | undefined,
  sessions: WorkoutSession[]
): Promise<{ scheduled: number }> {
  if (!remindersSupported()) return { scheduled: 0 }
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  const ids = Array.from({ length: 7 }, (_, weekday) => ({ id: REMINDER_BASE_ID + weekday }))
  await LocalNotifications.cancel({ notifications: ids })
  if (!preferences?.enabled) { announceSync(0); return { scheduled: 0 } }

  const permission = await LocalNotifications.requestPermissions()
  if (permission.display !== 'granted') { announceSync(0); return { scheduled: 0 } }

  await ensureAlertChannel()
  const time = reminderTime(preferences, sessions)
  const notifications = []
  for (let weekday = 0; weekday < 7; weekday += 1) {
    const message = reminderMessage(workoutsForWeekday(workouts, weekday).map((workout) => workout.name))
    if (!message) continue
    notifications.push({
      id: REMINDER_BASE_ID + weekday,
      title: message,
      body: 'Seu treino está pronto. Toque para começar.',
      // Capacitor weekdays start at Sunday = 1.
      schedule: { on: { weekday: weekday + 1, hour: Math.floor(time / 60), minute: time % 60 }, allowWhileIdle: true },
      channelId: ALERT_CHANNEL_ID,
    })
  }
  if (notifications.length > 0) await LocalNotifications.schedule({ notifications })
  announceSync(notifications.length)
  return { scheduled: notifications.length }
}
