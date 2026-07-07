'use client'

import { useEffect } from 'react'
import { useProfileStore } from '@/stores/useProfileStore'
import { ACHIEVEMENTS } from '@/lib/achievements'

export function AchievementToast() {
  const { newlyUnlocked, clearNewlyUnlocked } = useProfileStore()

  useEffect(() => {
    if (newlyUnlocked.length > 0) {
      const t = setTimeout(clearNewlyUnlocked, 4000)
      return () => clearTimeout(t)
    }
  }, [newlyUnlocked, clearNewlyUnlocked])

  const defs = newlyUnlocked
    .map((id) => ACHIEVEMENTS.find((a) => a.id === id))
    .filter(Boolean)

  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex flex-col items-center gap-2 pointer-events-none px-4">
      {defs.slice(0, 3).map((def) => (
        <div
          key={def!.id}
          className="flex items-center gap-3 rounded-2xl px-4 py-3 border shadow-2xl"
          style={{
            background: `${def!.color}15`,
            borderColor: `${def!.color}30`,
          }}
        >
          <span className="text-2xl">{def!.icon}</span>
          <div>
            <p className="text-xs font-semibold" style={{ color: def!.color }}>
              CONQUISTA DESBLOQUEADA
            </p>
            <p className="text-sm font-bold text-white">{def!.title}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
