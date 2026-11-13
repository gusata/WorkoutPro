import { Capacitor } from '@capacitor/core'

const REST_NOTIF_ID = 1001
export const ALERT_CHANNEL_ID = 'workoutpro_alert'

let channelReady: Promise<void> | null = null

/** Android 8+ silently drops notifications posted to a channel that was never created. */
export function ensureAlertChannel(): Promise<void> {
  if (typeof window === 'undefined' || !Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return Promise.resolve()
  }
  channelReady ??= import('@capacitor/local-notifications')
    .then(({ LocalNotifications }) => LocalNotifications.createChannel({
      id: ALERT_CHANNEL_ID,
      name: 'Avisos de treino',
      description: 'Fim do descanso e lembretes de treino',
      importance: 4,
      vibration: true,
    }))
    .catch(() => { channelReady = null })
  return channelReady
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false

  if (!Capacitor.isNativePlatform()) {
    if (!('Notification' in window)) return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false
    return (await Notification.requestPermission()) === 'granted'
  }

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const { display } = await LocalNotifications.requestPermissions()
    return display === 'granted'
  } catch {
    return false
  }
}

export async function scheduleRestEndNotification(seconds: number): Promise<void> {
  if (typeof window === 'undefined') return
  if (!Capacitor.isNativePlatform()) return

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await ensureAlertChannel()
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIF_ID }] })
    await LocalNotifications.schedule({
      notifications: [
        {
          id: REST_NOTIF_ID,
          title: 'Descanso terminado',
          body: 'Hora da próxima série',
          schedule: { at: new Date(Date.now() + seconds * 1000), allowWhileIdle: true },
          channelId: ALERT_CHANNEL_ID,
        },
      ],
    })
  } catch {}
}

export async function cancelRestNotification(): Promise<void> {
  if (typeof window === 'undefined') return
  if (!Capacitor.isNativePlatform()) return

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIF_ID }] })
  } catch {}
}
