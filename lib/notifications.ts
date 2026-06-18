import { Capacitor } from '@capacitor/core'

const REST_NOTIF_ID = 1001

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
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIF_ID }] })
    await LocalNotifications.schedule({
      notifications: [
        {
          id: REST_NOTIF_ID,
          title: 'Descanso terminado! 💪',
          body: 'Hora da próxima série',
          schedule: { at: new Date(Date.now() + seconds * 1000), allowWhileIdle: true },
          channelId: 'workoutpro_alert',
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
