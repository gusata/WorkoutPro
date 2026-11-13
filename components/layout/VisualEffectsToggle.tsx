'use client'

import { useSyncExternalStore } from 'react'
import { REDUCE_EFFECTS_STORAGE_KEY, safeStorageSet } from '@/lib/theme'

const CHANGED_EVENT = 'workoutpro:reduce-effects-changed'

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED_EVENT, onChange)
  return () => window.removeEventListener(CHANGED_EVENT, onChange)
}

function readPreference() {
  return document.documentElement.classList.contains('reduce-effects')
}

/** "Reduce effects" preference (applied before paint by the bootstrap script in app/layout.tsx). */
export function useReduceEffects(): [boolean, (enabled: boolean) => void] {
  const enabled = useSyncExternalStore(subscribe, readPreference, () => false)
  function setEnabled(next: boolean) {
    document.documentElement.classList.toggle('reduce-effects', next)
    safeStorageSet(REDUCE_EFFECTS_STORAGE_KEY, String(next))
    window.dispatchEvent(new Event(CHANGED_EVENT))
  }
  return [enabled, setEnabled]
}
