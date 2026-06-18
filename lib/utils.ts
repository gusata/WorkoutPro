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
