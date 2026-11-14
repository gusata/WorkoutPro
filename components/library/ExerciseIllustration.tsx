'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Dumbbell } from 'lucide-react'
import { cn } from '@/lib/cn'
import { libraryImageUrls, type LibraryExercise } from '@/lib/exerciseLibrary'

const FRAME_MS = 1100
const REDUCE_EFFECTS_EVENT = 'workoutpro:reduce-effects-changed'

function subscribeMotion(callback: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', callback)
  window.addEventListener(REDUCE_EFFECTS_EVENT, callback)
  return () => {
    media.removeEventListener('change', callback)
    window.removeEventListener(REDUCE_EFFECTS_EVENT, callback)
  }
}
function prefersStill() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-effects')
}

function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function Fallback({ item, offline, className }: { item: LibraryExercise; offline: boolean; className?: string }) {
  return (
    <div className={cn('flex aspect-[3/2] w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-[var(--fill)] text-[var(--muted)]', className)} role="img" aria-label={`Sem ilustração. ${item.muscleGroup}`}>
      <Dumbbell size={30} aria-hidden />
      <span className="footnote font-semibold">{item.muscleGroup}</span>
      {offline && <span className="caption">Ilustração disponível com internet</span>}
    </div>
  )
}

/**
 * Start/end photos from free-exercise-db alternating like a 2-frame animation.
 * Loaded on demand from the pinned CDN (never bundled); falls back to an icon + muscle group
 * when there is no equivalent image, or it fails to load (offline). Reconnecting retries.
 * With reduced motion (system or the app's "reduzir efeitos") it stays still; a tap switches frames.
 */
export function ExerciseIllustration({ item, className }: { item: LibraryExercise; className?: string }) {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)
  if (!item.imageId) return <Fallback item={item} offline={false} className={className} />
  return <Frames key={`${item.id}:${online}`} item={item} online={online} className={className} />
}

function Frames({ item, online, className }: { item: LibraryExercise; online: boolean; className?: string }) {
  const urls = libraryImageUrls(item)!
  const still = useSyncExternalStore(subscribeMotion, prefersStill, () => true)
  const [loaded, setLoaded] = useState<[boolean, boolean]>([false, false])
  const [failed, setFailed] = useState(false)
  const [frame, setFrame] = useState(0)
  const ready = loaded[0] && loaded[1]

  useEffect(() => {
    if (still || !ready) return
    const timer = window.setInterval(() => setFrame((current) => 1 - current), FRAME_MS)
    return () => window.clearInterval(timer)
  }, [still, ready])

  // Always try to load: offline, the HTTP cache may still hold the frames (served as immutable).
  if (failed) return <Fallback item={item} offline={!online} className={className} />

  const markLoaded = (index: number) => setLoaded((current) => (index === 0 ? [true, current[1]] : [current[0], true]))

  return (
    <button
      type="button"
      onClick={() => setFrame((current) => 1 - current)}
      className={cn('relative block aspect-[3/2] w-full overflow-hidden rounded-[var(--radius-lg)] bg-white', className)}
      aria-label={`${item.name}: ${frame === 0 ? 'posição inicial' : 'posição final'}. Toque para alternar.`}
    >
      {urls.map((src, index) => (
        // eslint-disable-next-line @next/next/no-img-element -- remote public-domain photo; static export has no image optimizer
        <img
          key={src}
          src={src}
          alt=""
          draggable={false}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => markLoaded(index)}
          onError={() => setFailed(true)}
          className={cn('absolute inset-0 h-full w-full object-contain transition-opacity duration-300', frame === index ? 'opacity-100' : 'opacity-0')}
        />
      ))}
      {!loaded[0] && <span aria-hidden className="absolute inset-0 flex items-center justify-center text-[var(--muted)]"><Dumbbell size={26} /></span>}
      <span aria-hidden className="caption absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 font-semibold text-white">{frame === 0 ? 'Início' : 'Fim'}</span>
    </button>
  )
}
