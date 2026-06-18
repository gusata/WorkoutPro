'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
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

const ACCENT = '#00c896'

export function BottomNav() {
  const pathname = usePathname()
  const active = useSessionStore((s) => s.active)

  return (
    <div className="fixed bottom-4 left-0 right-0 z-40 flex justify-center px-8 pointer-events-none">
      <motion.nav
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', damping: 22, stiffness: 260 }}
        className="w-fit flex items-center gap-1 rounded-2xl backdrop-blur-2xl p-2 shadow-2xl pointer-events-auto"
        style={{
          background: 'rgba(8, 8, 9, 0.88)',
          border: '1px solid rgba(255, 255, 255, 0.09)',
          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 transition-colors min-w-[56px]',
                isActive ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'
              )}
            >
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background: 'rgba(0, 200, 150, 0.1)',
                      border: '1px solid rgba(0, 200, 150, 0.18)',
                    }}
                    transition={{ type: 'spring', damping: 22, stiffness: 300 }}
                  />
                )}
              </AnimatePresence>

              <div className="relative">
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  style={isActive ? { color: ACCENT } : undefined}
                />
                {item.href === '/workouts' && active && (
                  <span
                    className="absolute -top-1 -right-1 h-2 w-2 rounded-full border border-[#080809] animate-pulse"
                    style={{ background: ACCENT }}
                  />
                )}
              </div>

              <span
                className="text-[10px] font-medium leading-none"
                style={isActive ? { color: ACCENT } : undefined}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </motion.nav>
    </div>
  )
}
