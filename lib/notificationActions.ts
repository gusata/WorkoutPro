import type { ActiveSession, ActiveSet } from '@/types'
import type { NotificationAction } from '@/lib/timerPlugin'

/** What applying a notification action may touch (the session and timer stores in the app). */
export interface NotificationActionTargets {
  getActive: () => ActiveSession | null
  completeSet: (exerciseId: string, setId: string) => void
  updateSet: (exerciseId: string, setId: string, updates: Partial<ActiveSet>) => void
  syncRest: (endAt: number | null, total?: number) => void
}

/** Session start times survive a JSON round trip exactly; allow a little slack anyway. */
const SAME_SESSION_MS = 1000
const MAX_SEEN = 200

function sameSession(active: ActiveSession, action: NotificationAction) {
  return Math.abs(new Date(active.startedAt).getTime() - action.workoutStartedAt) < SAME_SESSION_MS
}

function remember(seen: Set<string>, id: string) {
  seen.add(id)
  if (seen.size > MAX_SEEN) seen.delete(seen.values().next().value as string)
}

/**
 * Applies notification buttons that were already handled natively, in tap order.
 * Idempotent: an action id is applied once, and "Série feita" never un-completes a set
 * (the store's completeSet toggles).
 */
export function applyNotificationActions(
  actions: NotificationAction[],
  targets: NotificationActionTargets,
  seen: Set<string>,
): number {
  let applied = 0
  for (const action of actions) {
    if (!action || typeof action.id !== 'string' || seen.has(action.id)) continue
    remember(seen, action.id)
    const active = targets.getActive()
    // Leftovers of a session that already ended (or of another one) are dropped.
    if (!active || !sameSession(active, action)) continue

    if (action.type === 'completeSet') {
      const exercise = active.exercises.find((item) => item.exerciseId === action.exerciseId)
      const set = exercise?.sets.find((item) => item.id === action.setId)
      if (set && !set.completed) {
        targets.completeSet(action.exerciseId, action.setId)
        targets.updateSet(action.exerciseId, action.setId, { completedAt: new Date(action.at) })
      }
      targets.syncRest(action.restEndAt ?? null, action.restTotal)
    } else if (action.type === 'extendRest') {
      targets.syncRest(action.restEndAt, action.restTotal)
    } else if (action.type === 'skipRest') {
      targets.syncRest(null)
    } else {
      continue
    }
    applied += 1
  }
  return applied
}

/**
 * Serializes drains: the native event, the resume hook and the mount can fire together,
 * and each drain must see the queue only once.
 */
export function createActionDrainer(
  consume: () => Promise<{ actions: NotificationAction[] }>,
  targets: NotificationActionTargets,
) {
  const seen = new Set<string>()
  let chain: Promise<number> = Promise.resolve(0)
  return function drain(): Promise<number> {
    chain = chain
      .catch(() => 0)
      .then(async () => {
        const { actions } = await consume()
        return applyNotificationActions(Array.isArray(actions) ? actions : [], targets, seen)
      })
    return chain
  }
}
