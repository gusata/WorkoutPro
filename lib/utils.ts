import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function formatVolume(kg: number): string {
  if (kg >= 1000000) return `${(kg / 1000000).toFixed(1)}M kg`
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k kg`
  return `${kg.toFixed(0)} kg`
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}min`
  if (m > 0) return `${m}min ${s.toString().padStart(2, '0')}s`
  return `${s}s`
}

export function formatDate(date: Date): string {
  if (isToday(date)) return 'Hoje'
  if (isYesterday(date)) return 'Ontem'
  return format(date, "d 'de' MMM", { locale: ptBR })
}

export function formatRelative(date: Date): string {
  return formatDistanceToNow(date, { locale: ptBR, addSuffix: true })
}

export function calculateVolume(weight: number, reps: number, sets: number): number {
  return weight * reps * sets
}

export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export const MUSCLE_GROUPS = [
  'Peitoral',
  'Costas',
  'Ombros',
  'Bíceps',
  'Tríceps',
  'Antebraço',
  'Abdômen',
  'Quadríceps',
  'Posterior',
  'Glúteo',
  'Panturrilha',
  'Trapézio',
  'Lombar',
  'Full Body',
] as const

export const WORKOUT_COLORS = [
  '#6366f1', // indigo
  '#f43f5e', // rose
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#84cc16', // lime
]

export const WORKOUT_ICONS = [
  'Dumbbell',
  'Zap',
  'Flame',
  'Target',
  'Trophy',
  'Star',
  'Shield',
  'Swords',
  'Activity',
  'Heart',
  'Mountain',
  'Wind',
]

export const REST_PRESETS = [30, 45, 60, 90, 120, 180]

/**
 * Parses user-typed numbers accepting both "22.5" and the pt-BR "22,5".
 * Returns null for empty/invalid input so callers can keep the previous value.
 */
export function parseDecimal(text: string): number | null {
  const normalized = text.trim().replace(/\s/g, '').replace(',', '.')
  if (normalized === '' || normalized === '.') return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

/** Formats a number for an editable pt-BR field ("22,5", "80"). */
export function formatDecimal(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return ''
  return String(Math.round(value * 100) / 100).replace('.', ',')
}

/**
 * Icon color that stays legible on a user-picked workout color. White is kept
 * whenever it reaches the 3:1 non-text contrast minimum (WCAG 1.4.11); light
 * colors such as yellow, lime or emerald get a near-black glyph instead.
 */
export function readableOn(hex: string, minContrast = 3): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return '#ffffff'
  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(match[1].slice(offset, offset + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  return 1.05 / (luminance + 0.05) >= minContrast ? '#ffffff' : '#111114'
}
