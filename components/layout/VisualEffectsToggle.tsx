'use client'

import { useEffect, useState } from 'react'
import { Gauge } from 'lucide-react'

const STORAGE_KEY = 'workoutpro-reduce-effects'

function applyPreference(enabled: boolean) {
  document.documentElement.classList.toggle('reduce-effects', enabled)
}

export function VisualEffectsSync() {
  useEffect(() => {
    const enabled = window.localStorage.getItem(STORAGE_KEY) === 'true'
    applyPreference(enabled)
  }, [])

  return null
}

export function VisualEffectsToggle() {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  })

  useEffect(() => {
    applyPreference(enabled)
  }, [enabled])

  function toggle() {
    const next = !enabled
    setEnabled(next)
    window.localStorage.setItem(STORAGE_KEY, String(next))
    applyPreference(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex items-center gap-3 rounded-2xl bg-[var(--surface-2)] px-3 py-2 text-left"
      aria-pressed={enabled}
    >
      <span className="soft-icon flex h-9 w-9 items-center justify-center rounded-xl">
        <Gauge size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[var(--foreground)]">Reduzir efeitos</span>
        <span className="block text-xs text-[var(--muted)]">{enabled ? 'Ativo' : 'Desativado'}</span>
      </span>
      <span
        className="relative h-6 w-11 rounded-full transition-colors"
        style={{ background: enabled ? 'var(--accent)' : 'var(--surface-3)' }}
      >
        <span
          className="absolute top-1 h-4 w-4 rounded-full bg-white transition-transform"
          style={{ transform: enabled ? 'translateX(22px)' : 'translateX(4px)' }}
        />
      </span>
    </button>
  )
}
