/**
 * Incremental-sync cursor per Supabase user: the newest server-side `updated_at`
 * already applied locally. Without a cursor the next sync is a full one.
 */
const CURSOR_KEY_PREFIX = 'workoutpro.sync-cursor.v1:'

function cursorKey(userId: string) {
  return `${CURSOR_KEY_PREFIX}${userId}`
}

export function readCursor(userId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(cursorKey(userId))
  } catch {
    return null
  }
}

export function writeCursor(userId: string, value: string | null) {
  if (typeof window === 'undefined' || !value) return
  try {
    window.localStorage.setItem(cursorKey(userId), value)
  } catch {
    // Without a cursor the next sync is simply a full one.
  }
}

/** True once this device completed a full sync for the user; later syncs are incremental. */
export function hasSyncCursor(userId: string) {
  return readCursor(userId) !== null
}

/** Forget every cursor (local data was wiped), forcing a full pull next time. */
export function clearSyncCursors() {
  if (typeof window === 'undefined') return
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index)
      if (key?.startsWith(CURSOR_KEY_PREFIX)) window.localStorage.removeItem(key)
    }
  } catch {
    // ignore
  }
}
