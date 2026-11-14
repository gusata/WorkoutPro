'use client'

import { useEffect, useState } from 'react'
import { pendingReminderCount, REMINDERS_SYNCED_EVENT, scheduledRemindersLabel } from '@/lib/reminders'

/**
 * Shows how many weekly reminders the OS really holds (installed app only), so the user —
 * and the device E2E flow — can confirm that scheduling worked.
 */
export function ReminderScheduleStatus() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    const refresh = () => { void pendingReminderCount().then((value) => { if (alive) setCount(value) }) }
    const onSynced = () => refresh()
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    refresh()
    window.addEventListener(REMINDERS_SYNCED_EVENT, onSynced)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      window.removeEventListener(REMINDERS_SYNCED_EVENT, onSynced)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  if (count == null) return null
  return (
    <p className="list-footer" role="status" aria-live="polite" data-testid="reminders-scheduled">
      {scheduledRemindersLabel(count)}
    </p>
  )
}
