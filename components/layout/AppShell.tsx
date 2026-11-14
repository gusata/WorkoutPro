'use client'

import { BottomNav } from '@/components/navigation/BottomNav'
import { AchievementToast } from '@/components/achievements/AchievementToast'
import { ServiceWorkerRegister } from '@/components/layout/ServiceWorkerRegister'
import { ThemeSync } from '@/components/layout/ThemeToggle'
import { NativeRuntimeHints } from '@/components/layout/NativeRuntimeHints'
import { ReminderSync } from '@/components/layout/ReminderSync'
import { HealthSync } from '@/components/layout/HealthSync'
import { AuthGate } from '@/components/auth/AuthGate'
import { DeepLinkHandler } from '@/components/layout/DeepLinkHandler'
import { WidgetSync } from '@/components/layout/WidgetSync'
import { NotificationActionSync } from '@/components/timer/NotificationActionSync'

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
        <WidgetSync />
        <DeepLinkHandler />
        <NotificationActionSync />
      </AuthGate>
    </div>
  )
}
