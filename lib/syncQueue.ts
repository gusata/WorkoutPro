'use client'

import { db } from '@/lib/db'
import { generateId } from '@/lib/utils'
import type { SyncEntity, SyncQueueItem } from '@/types'

export async function queueSync(entity: SyncEntity, entityId: string, operation: SyncQueueItem['operation'] = 'upsert') {
  const existing = await db.syncQueue
    .where('[entity+entityId]')
    .equals([entity, entityId])
    .first()
    .catch(() => null)

  if (existing) {
    await db.syncQueue.update(existing.id, {
      operation,
      createdAt: new Date(),
    })
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('workoutpro:sync-needed'))
    }
    return
  }

  await db.syncQueue.add({
    id: generateId(),
    entity,
    entityId,
    operation,
    createdAt: new Date(),
    attempts: 0,
  })
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('workoutpro:sync-needed'))
  }
}

export async function queueFullSync() {
  await Promise.all([
    queueSync('profile', 'profile'),
    queueSync('workouts', '*'),
    queueSync('exercises', '*'),
    queueSync('sessions', '*'),
    queueSync('measurements', '*'),
    queueSync('achievements', '*'),
  ])
}
