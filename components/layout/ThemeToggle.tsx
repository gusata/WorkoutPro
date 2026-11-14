'use client'

import { useEffect, useSyncExternalStore } from 'react'
import {
  applyTheme, readTheme, readThemePreference, safeStorageRemove, safeStorageSet, systemTheme,
  THEME_CHANGED_EVENT, THEME_STORAGE_KEY, type Theme, type ThemePreference,
} from '@/lib/theme'

export { THEME_CHANGED_EVENT }

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_CHANGED_EVENT, onChange)
  return () => window.removeEventListener(THEME_CHANGED_EVENT, onChange)
}

/** Reads the theme from <html data-theme> (set before paint), so server and client agree on hydration. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => 'light')
}

/** The stored choice: light, dark or follow the system. */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, readThemePreference, () => 'system')
}

export function setTheme(preference: ThemePreference) {
  if (preference === 'system') safeStorageRemove(THEME_STORAGE_KEY)
  else safeStorageSet(THEME_STORAGE_KEY, preference)
  const theme = preference === 'system' ? systemTheme() : preference
  applyTheme(theme)
  window.dispatchEvent(new CustomEvent<Theme>(THEME_CHANGED_EVENT, { detail: theme }))
}

/** Syncs the theme-color meta tag and follows OS changes while "Automático" is selected. */
export function ThemeSync() {
  useEffect(() => {
    applyTheme(readTheme())
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return
    const onChange = () => {
      if (readThemePreference() !== 'system') return
      applyTheme(systemTheme())
      window.dispatchEvent(new Event(THEME_CHANGED_EVENT))
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return null
}
