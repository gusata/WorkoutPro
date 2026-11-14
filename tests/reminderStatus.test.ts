import { describe, expect, it } from 'vitest'
import { countReminderNotifications, isReminderId, pendingReminderCount, scheduledRemindersLabel } from '@/lib/reminders'

describe('reminder schedule status', () => {
  it('recognises only the seven weekly reminder ids', () => {
    expect(isReminderId(3000)).toBe(true)
    expect(isReminderId(3006)).toBe(true)
    expect(isReminderId(2999)).toBe(false)
    expect(isReminderId(3007)).toBe(false)
    // The rest-end alert (1001) and the timer service notification (2001) are not reminders.
    expect(isReminderId(1001)).toBe(false)
    expect(isReminderId(2001)).toBe(false)
    expect(isReminderId(3000.5)).toBe(false)
  })

  it('counts pending reminders and ignores other notifications', () => {
    expect(countReminderNotifications([])).toBe(0)
    expect(countReminderNotifications([{ id: 1001 }, { id: 3000 }, { id: 3003 }, { id: 3006 }, { id: 42 }])).toBe(3)
  })

  it('describes the scheduled count in pt-BR', () => {
    expect(scheduledRemindersLabel(0)).toBe('Nenhum lembrete agendado neste aparelho.')
    expect(scheduledRemindersLabel(1)).toBe('1 lembrete semanal agendado neste aparelho.')
    expect(scheduledRemindersLabel(7)).toBe('7 lembretes semanais agendados neste aparelho.')
  })

  it('does not report a count outside the installed app', async () => {
    await expect(pendingReminderCount()).resolves.toBeNull()
  })
})
