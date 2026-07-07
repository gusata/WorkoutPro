'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Dumbbell, BarChart3, Trophy, User } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useSessionStore } from '@/stores/useSessionStore'

const NAV_ITEMS = [
  { href: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/workouts',     icon: Dumbbell,        label: 'Treinos'   },
  { href: '/stats',        icon: BarChart3,        label: 'Stats'     },
  { href: '/achievements', icon: Trophy,           label: 'Conquistas'},
  { href: '/profile',      icon: User,            label: 'Perfil'    },
]

export function BottomNav() {
  const pathname = usePathname()
  const active = useSessionStore((s) => s.active)

  return (
    <div
      className="fixed left-0 right-0 z-40 flex justify-center px-12 pointer-events-none"
      style={{
        bottom: 'max(1rem, env(safe-area-inset-bottom))',
        transform: 'translate3d(0,0,0)',
        willChange: 'transform',
      }}
    >
      <nav
        className="w-fit flex items-center gap-2 rounded-full backdrop-blur-2xl p-1.5 pointer-events-auto"
        style={{
          background: 'var(--nav-bg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow)',
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={cn(
                'relative flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                isActive ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              )}
            >
              {isActive && (
                <div
                  className="absolute inset-1 rounded-full"
                  style={{
                    background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--accent) 18%, transparent)',
                  }}
                />
              )}

              <div className="relative">
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  style={isActive ? { color: 'var(--accent)' } : undefined}
                />
                {item.href === '/workouts' && active && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full border border-[#080809] animate-pulse" style={{ background: 'var(--accent)' }} />
                )}
              </div>

              <span
                className="sr-only"
                style={isActive ? { color: 'var(--accent)' } : undefined}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
