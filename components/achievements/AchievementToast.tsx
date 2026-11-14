'use client'

import { useEffect } from 'react'
import { useProfileStore } from '@/stores/useProfileStore'
import { ACHIEVEMENTS } from '@/lib/achievements'
import { AchievementIcon } from '@/components/achievements/AchievementIcon'

export function AchievementToast() {
  const newlyUnlocked = useProfileStore((state) => state.newlyUnlocked)
  const clearNewlyUnlocked = useProfileStore((state) => state.clearNewlyUnlocked)

  useEffect(() => {
    if (newlyUnlocked.length === 0) return
    const timeout = setTimeout(clearNewlyUnlocked, 5000)
    return () => clearTimeout(timeout)
  }, [newlyUnlocked, clearNewlyUnlocked])

  const defs = newlyUnlocked.flatMap((id) => ACHIEVEMENTS.filter((achievement) => achievement.id === id))

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-0 right-0 z-50 flex flex-col items-center gap-2 px-4"
      style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
    >
      {defs.slice(0, 3).map((def) => (
        <button
          key={def.id}
          type="button"
          onClick={clearNewlyUnlocked}
          className="toast-enter pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-[22px] bg-[var(--surface-solid)] px-4 py-3.5 text-left text-[var(--foreground)] shadow-[var(--shadow-float)] ring-[0.5px] ring-[var(--hairline)]"
        >
          <AchievementIcon icon={def.icon} color={def.color} size={20} className="h-11 w-11 rounded-2xl" />
          <span className="min-w-0">
            <span className="caption block font-semibold uppercase tracking-wide text-[var(--highlight)]">Conquista desbloqueada</span>
            <span className="headline block truncate">{def.title}</span>
          </span>
          <span className="sr-only">Toque para dispensar</span>
        </button>
      ))}
    </div>
  )
}
