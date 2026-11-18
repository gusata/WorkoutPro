'use client'

/**
 * Tactile feedback. On the native app it uses the Taptic/vibration engine through
 * @capacitor/haptics (short, crisp impacts); on the web it falls back to navigator.vibrate,
 * which only Android browsers honor. Every call is fire-and-forget and never throws.
 */

type Kind = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning'

const WEB_PATTERNS: Record<Kind, number | number[]> = {
  light: 8,
  medium: 14,
  heavy: 24,
  selection: 5,
  success: [12, 60, 18],
  warning: [20, 80, 20],
}

let native: Promise<typeof import('@capacitor/haptics') | null> | null = null

function loadNative() {
  if (!native) {
    native = import('@capacitor/core')
      .then(({ Capacitor }) => (Capacitor.isNativePlatform() ? import('@capacitor/haptics') : null))
      .catch(() => null)
  }
  return native
}

function webVibrate(kind: Kind) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(WEB_PATTERNS[kind])
  } catch {
    // Some browsers throw when vibration is blocked by policy; feedback is optional.
  }
}

export function haptic(kind: Kind = 'light') {
  if (typeof window === 'undefined') return
  void loadNative().then(async (mod) => {
    if (!mod) return webVibrate(kind)
    const { Haptics, ImpactStyle, NotificationType } = mod
    try {
      if (kind === 'selection') await Haptics.selectionChanged()
      else if (kind === 'success') await Haptics.notification({ type: NotificationType.Success })
      else if (kind === 'warning') await Haptics.notification({ type: NotificationType.Warning })
      else await Haptics.impact({ style: kind === 'heavy' ? ImpactStyle.Heavy : kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light })
    } catch {
      webVibrate(kind)
    }
  })
}
