import { db } from '@/lib/db'
import { generateId } from '@/lib/utils'
import type { MediaItem, MediaKind } from '@/types'

export const MAX_VIDEO_BYTES = 200 * 1024 * 1024

export async function saveMedia(
  file: Blob,
  kind: MediaKind,
  links: Pick<MediaItem, 'sessionId' | 'exerciseId' | 'setId' | 'note'> = {},
  createdAt: Date = new Date()
): Promise<MediaItem> {
  if (kind === 'video' && file.size > MAX_VIDEO_BYTES) {
    throw new Error('O vídeo passa de 200 MB. Grave um trecho mais curto.')
  }
  const item: MediaItem = {
    id: generateId(),
    kind,
    blob: file,
    mimeType: file.type || (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
    createdAt,
    sessionId: links.sessionId ?? null,
    exerciseId: links.exerciseId ?? null,
    setId: links.setId ?? null,
    note: links.note,
  }
  await db.media.add(item)
  return item
}

export function getMedia(id: string) {
  return db.media.get(id)
}

export function deleteMedia(id: string) {
  return db.media.delete(id)
}

export async function listMedia(kind: MediaKind, exerciseId?: string) {
  const items = await db.media.where('kind').equals(kind).toArray()
  return items
    .filter((item) => !exerciseId || item.exerciseId === exerciseId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

/** Downscales a photo so progress pictures don't fill the device storage. */
export async function compressImage(file: File, maxSide = 1600, quality = 0.85): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    return blob ?? file
  } catch {
    return file
  }
}
