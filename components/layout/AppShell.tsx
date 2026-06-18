'use client'

import { useEffect } from 'react'
import { BottomNav } from '@/components/navigation/BottomNav'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { AchievementToast } from '@/components/achievements/AchievementToast'
import { ServiceWorkerRegister } from '@/components/layout/ServiceWorkerRegister'
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
    <div className="min-h-screen text-white">
      <ServiceWorkerRegister />
      <main className="pb-28">
        {children}
      </main>
      <BottomNav />
      <AchievementToast />
    </div>
  )
}
