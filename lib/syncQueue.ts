'use client'

import { db } from '@/lib/db'
import { generateId } from '@/lib/utils'
import type { SyncEntity, SyncQueueItem } from '@/types'

export async function queueSync(entity: SyncEntity, entityId: string, operation: SyncQueueItem['operation'] = 'upsert') {
  await db.transaction('rw', db.syncQueue, async () => {
    const previous = await db.syncQueue
      .where('[entity+entityId]')
      .equals([entity, entityId])
      .toArray()
    if (previous.length > 0) await db.syncQueue.bulkDelete(previous.map((item) => item.id))
    await db.syncQueue.add({
      id: generateId(),
      entity,
      entityId,
      operation,
      createdAt: new Date(),
      attempts: 0,
      lastError: null,
    })
  })
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('workoutpro:sync-needed'))
  }
}

/** Queues an upsert for every local row in a single transaction (one bulk write instead of N). */
export async function queueFullSync() {
  await db.transaction('rw', [db.workouts, db.exercises, db.sessions, db.measurements, db.achievements, db.cardio, db.syncQueue], async () => {
    const [workouts, exercises, sessions, measurements, achievements, cardio, existing] = await Promise.all([
      db.workouts.toCollection().primaryKeys(),
      db.exercises.toCollection().primaryKeys(),
      db.sessions.toCollection().primaryKeys(),
      db.measurements.toCollection().primaryKeys(),
      db.achievements.toCollection().primaryKeys(),
      db.cardio.toCollection().primaryKeys(),
      db.syncQueue.toArray(),
    ])
    const targets: Array<[SyncEntity, string]> = [
      ['profile', 'profile'],
      ...workouts.map((id): [SyncEntity, string] => ['workouts', id]),
      ...exercises.map((id): [SyncEntity, string] => ['exercises', id]),
      ...sessions.map((id): [SyncEntity, string] => ['sessions', id]),
      ...measurements.map((id): [SyncEntity, string] => ['measurements', id]),
      ...achievements.map((id): [SyncEntity, string] => ['achievements', id]),
      ...cardio.map((id): [SyncEntity, string] => ['cardio', id]),
    ]
    const targetKeys = new Set(targets.map(([entity, id]) => `${entity}:${id}`))
    const superseded = existing.filter((item) => targetKeys.has(`${item.entity}:${item.entityId}`))
    if (superseded.length > 0) await db.syncQueue.bulkDelete(superseded.map((item) => item.id))
    const createdAt = new Date()
    await db.syncQueue.bulkAdd(targets.map(([entity, entityId]) => ({
      id: generateId(), entity, entityId, operation: 'upsert' as const, createdAt, attempts: 0, lastError: null,
    })))
  })
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('workoutpro:sync-needed'))
  }
}
