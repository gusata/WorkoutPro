'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/cn'

type Theme = 'light' | 'dark'

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') {
      return 'light'
    }

    const stored = window.localStorage.getItem('workoutpro-theme')
    return stored === 'dark' || stored === 'light' ? stored : 'light'
  })

  useEffect(() => {
    applyTheme(theme)
    window.localStorage.setItem('workoutpro-theme', theme)
  }, [theme])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
  }

  const Icon = theme === 'dark' ? Sun : Moon

  return (
    <button
      type="button"
      aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
      onClick={toggleTheme}
      className={cn(
        'theme-toggle flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-95'
      )}
    >
      <Icon size={18} strokeWidth={2.2} />
    </button>
  )
}

export function ThemeSync() {
  useEffect(() => {
    const stored = window.localStorage.getItem('workoutpro-theme')
    const initial = stored === 'dark' || stored === 'light' ? stored : 'light'
    applyTheme(initial)
  }, [])

  return null
}
