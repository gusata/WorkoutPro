import { Capacitor, registerPlugin } from '@capacitor/core'

export interface HealthChangesResult {
  available: boolean
  /** No usable sync token (first run, permissions changed, token expired): do one full read. */
  reset?: boolean
  /** Health Connect types with new / edited records since the last check; "deleted" for deletions. */
  changed?: string[]
}

interface HealthChangesPluginInterface {
  check(): Promise<HealthChangesResult>
  reset(): Promise<void>
}

/** Native Health Connect Changes API (android/app/.../HealthChangesPlugin.kt). Android only. */
const HealthChanges = registerPlugin<HealthChangesPluginInterface>('HealthChanges')

/** `null` where the Changes API does not exist (web, iOS): callers fall back to polling. */
export async function checkHealthChanges(): Promise<HealthChangesResult | null> {
  if (typeof window === 'undefined' || Capacitor.getPlatform() !== 'android') return null
  return HealthChanges.check()
}
