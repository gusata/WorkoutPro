export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'workoutpro-theme'
export const REDUCE_EFFECTS_STORAGE_KEY = 'workoutpro-reduce-effects'
export const THEME_CHANGED_EVENT = 'workoutpro:theme-changed'

export const THEME_COLORS: Record<Theme, string> = {
  light: '#f5f5f7',
  dark: '#000000',
}

/**
 * Runs inline in <head> before first paint, so the stored theme (or the system
 * preference when nothing is stored) is applied without a light-mode flash.
 * Must stay dependency-free: it is serialized as a string.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{
var d=document.documentElement,s=localStorage.getItem('${THEME_STORAGE_KEY}');
var t=s==='dark'||s==='light'?s:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
d.dataset.theme=t;d.style.colorScheme=t;
var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='dark'?'${THEME_COLORS.dark}':'${THEME_COLORS.light}');
if(localStorage.getItem('${REDUCE_EFFECTS_STORAGE_KEY}')==='true')d.classList.add('reduce-effects');
}catch(e){}})();`

export type ThemePreference = Theme | 'system'

export function readThemePreference(): ThemePreference {
  const stored = safeStorageGet(THEME_STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

export function systemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function safeStorageRemove(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignore unavailable storage.
  }
}

export function readTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
}

export function safeStorageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function safeStorageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable (private mode / quota); preferences just won't persist.
  }
}
