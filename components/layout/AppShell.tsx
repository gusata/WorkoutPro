'use client'

import { BottomNav } from '@/components/navigation/BottomNav'
import { AchievementToast } from '@/components/achievements/AchievementToast'
import { ServiceWorkerRegister } from '@/components/layout/ServiceWorkerRegister'
import { ThemeSync } from '@/components/layout/ThemeToggle'
import { NativeRuntimeHints } from '@/components/layout/NativeRuntimeHints'
import { ReminderSync } from '@/components/layout/ReminderSync'
import { HealthSync } from '@/components/layout/HealthSync'
import { WearSync } from '@/components/layout/WearSync'
import { AuthGate } from '@/components/auth/AuthGate'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <a href="#app-content" className="skip-link">Pular para o conteúdo</a>
      <ServiceWorkerRegister />
      <ThemeSync />
      <NativeRuntimeHints />
      <AuthGate>
        <main id="app-content">
          {children}
        </main>
        <BottomNav />
        <AchievementToast />
        <ReminderSync />
        <HealthSync />
        <WearSync />
      </AuthGate>
    </div>
  )
}
