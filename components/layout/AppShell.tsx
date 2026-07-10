'use client'

import { BottomNav } from '@/components/navigation/BottomNav'
import { AchievementToast } from '@/components/achievements/AchievementToast'
import { ServiceWorkerRegister } from '@/components/layout/ServiceWorkerRegister'
import { ThemeSync } from '@/components/layout/ThemeToggle'
import { NativeRuntimeHints } from '@/components/layout/NativeRuntimeHints'
import { VisualEffectsSync } from '@/components/layout/VisualEffectsToggle'
import { AuthGate } from '@/components/auth/AuthGate'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <a href="#app-content" className="skip-link">Pular para o conteudo</a>
      <ServiceWorkerRegister />
      <ThemeSync />
      <NativeRuntimeHints />
      <VisualEffectsSync />
      <AuthGate>
        <main id="app-content" className="pb-28">
          {children}
        </main>
        <BottomNav />
        <AchievementToast />
      </AuthGate>
    </div>
  )
}
