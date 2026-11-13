'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChartNoAxesColumn, Dumbbell, HeartPulse, House, UserRound } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useSessionStore } from '@/stores/useSessionStore'

const NAV_ITEMS = [
  { href: '/dashboard', icon: House, label: 'Hoje' },
  { href: '/workouts', icon: Dumbbell, label: 'Treinos' },
  { href: '/stats', icon: ChartNoAxesColumn, label: 'Progresso' },
  { href: '/health', icon: HeartPulse, label: 'Saúde' },
  { href: '/profile', icon: UserRound, label: 'Você' },
]

const ROOT_NAV_ROUTES = new Set(NAV_ITEMS.map((item) => item.href))

/** Quiet, full-width frosted tab bar with a hairline top edge. */
export function BottomNav() {
  const pathname = usePathname()
  const normalizedPathname = pathname === '/' ? pathname : pathname.replace(/\/+$/, '')
  const active = useSessionStore((s) => s.active)

  // Secondary and focused-flow screens have their own navigation/actions.
  if (!ROOT_NAV_ROUTES.has(normalizedPathname)) return null

  return (
    <div className="tabbar">
      {active && (
        <Link
          href="/workouts/execute"
          className="flex h-12 items-center gap-3 px-4 shadow-[inset_0_-0.5px_0_var(--hairline)]"
          aria-label={`Treino em andamento: ${active.workoutName}. Abrir`}
        >
          <span aria-hidden className="live-dot h-2 w-2 flex-none rounded-full bg-[var(--success-fill)]" />
          <span className="subhead min-w-0 flex-1 truncate font-semibold">{active.workoutName}</span>
          <span className="subhead flex-none text-[var(--accent)]">Continuar</span>
        </Link>
      )}
      <nav data-testid="bottom-nav" aria-label="Navegação principal" className="mx-auto grid h-[var(--tabbar-height)] max-w-lg grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const isActive = normalizedPathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex min-w-0 flex-col items-center justify-center gap-1 transition-colors duration-200',
                isActive ? 'text-[var(--foreground)]' : 'text-[var(--muted)]'
              )}
            >
              <Icon size={22} strokeWidth={isActive ? 2.1 : 1.6} aria-hidden />
              <span className={cn('text-[10.5px] leading-none tracking-[0]', isActive ? 'font-semibold' : 'font-medium')}>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
