'use client'

import { ViewTransition, type CSSProperties } from 'react'
import { cn } from '@/lib/cn'

/** "Push" -> "P", "Treino A" -> "TA", "Upper Lower 2" -> "UL". */
export function workoutMonogram(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/**
 * The routine's colored monogram. Shares a view-transition name with the same badge on the
 * detail page, so opening a routine morphs the badge into place instead of cutting.
 */
export function WorkoutBadge({ id, name, color, size = 48, className, morph = true }: { id: string; name: string; color: string; size?: number; className?: string; morph?: boolean }) {
  const style = { ...workoutColorVars(color), width: size, height: size, borderRadius: size * 0.3, fontSize: size * 0.42 } as CSSProperties
  // A view-transition name must be unique on the page, so only one copy of a routine's badge morphs.
  if (!morph) return <span aria-hidden className={cn('workout-badge', className)} style={style}>{workoutMonogram(name)}</span>
  return (
    <ViewTransition name={`workout-badge-${id}`} share="morph" default="none">
      <span aria-hidden className={cn('workout-badge', className)} style={style}>{workoutMonogram(name)}</span>
    </ViewTransition>
  )
}

export function WorkoutTitle({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <ViewTransition name={`workout-title-${id}`} share="morph" default="none">
      <span className={cn('block', className)}>{children}</span>
    </ViewTransition>
  )
}

/** "#f43f5e" + 0.2 -> "rgba(244, 63, 94, 0.2)". Anything that isn't hex passes through unchanged. */
export function withAlpha(color: string, alpha: number) {
  const hex = color.trim().replace(/^#/, '')
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
  if (!/^[0-9a-f]{6}$/i.test(full)) return color
  const value = Number.parseInt(full, 16)
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`
}

/** CSS variables for anything tinted by a routine color (cards, badges, glows). */
export function workoutColorVars(color: string): CSSProperties {
  return {
    '--wc': color,
    '--wc-tint': withAlpha(color, 0.13),
    '--wc-tint-strong': withAlpha(color, 0.24),
    '--wc-fade': withAlpha(color, 0.04),
    '--wc-glow': withAlpha(color, 0.38),
  } as CSSProperties
}

const DAY_MS = 86_400_000

/** Days between two dates by calendar day in local time. */
export function calendarDaysBetween(from: Date, to = new Date()) {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime()
  return Math.round((b - a) / DAY_MS)
}

export function relativeDay(date: Date | undefined, now = new Date()) {
  if (!date) return 'Nunca feito'
  const days = calendarDaysBetween(date, now)
  if (days <= 0) return 'Feito hoje'
  if (days === 1) return 'Ontem'
  if (days < 7) return `Há ${days} dias`
  const weeks = Math.floor(days / 7)
  if (days < 30) return `Há ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`
  const months = Math.floor(days / 30)
  return `Há ${months} ${months === 1 ? 'mês' : 'meses'}`
}
