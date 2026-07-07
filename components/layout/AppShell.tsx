'use client'

import { useEffect } from 'react'
import { BottomNav } from '@/components/navigation/BottomNav'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { AchievementToast } from '@/components/achievements/AchievementToast'
import { ServiceWorkerRegister } from '@/components/layout/ServiceWorkerRegister'
import { ThemeSync } from '@/components/layout/ThemeToggle'
import { NativeRuntimeHints } from '@/components/layout/NativeRuntimeHints'
import { VisualEffectsSync } from '@/components/layout/VisualEffectsToggle'
import { seedDemoData } from '@/lib/seed'

export function AppShell({ children }: { children: React.ReactNode }) {
  const loadWorkouts = useWorkoutStore((s) => s.load)
  const loadProfile = useProfileStore((s) => s.load)

  useEffect(() => {
    seedDemoData().then(() => {
      loadWorkouts()
      loadProfile()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen">
      <a href="#app-content" className="skip-link">Pular para o conteudo</a>
      <ServiceWorkerRegister />
      <ThemeSync />
      <NativeRuntimeHints />
      <VisualEffectsSync />
      <main id="app-content" className="pb-28">
        {children}
      </main>
      <BottomNav />
      <AchievementToast />
    </div>
  )
}
