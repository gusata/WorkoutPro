import {
  Anvil, Award, BicepsFlexed, CalendarCheck, CalendarRange, Crown, Dumbbell, Flame, Gem, Medal,
  Mountain, Star, Target, TrendingUp, Trophy, Zap, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'

const ICONS: Record<string, LucideIcon> = {
  Anvil, BicepsFlexed, CalendarCheck, CalendarRange, Crown, Dumbbell, Flame, Gem, Medal,
  Mountain, Star, Target, TrendingUp, Trophy, Zap,
}

/**
 * Achievement colors are bright pastels; mixing them with the foreground keeps the
 * glyph legible (>= 3:1) on both themes while preserving the hue.
 */
export function achievementTint(color: string) {
  return {
    background: `color-mix(in srgb, ${color} 16%, transparent)`,
    color: `color-mix(in srgb, ${color} 62%, var(--foreground))`,
  }
}

export function AchievementIcon({ icon, color, size = 22, className }: { icon: string; color: string; size?: number; className?: string }) {
  const Icon = ICONS[icon] ?? Award
  return (
    <span className={cn('flex flex-none items-center justify-center', className)} style={achievementTint(color)} aria-hidden>
      <Icon size={size} strokeWidth={2.1} />
    </span>
  )
}

/** Apple Fitness–style award medal: metallic disc with an inner bevel; greyed out until earned. */
export function AchievementMedal({ icon, color, unlocked, size = 88, className }: { icon: string; color: string; unlocked: boolean; size?: number; className?: string }) {
  const Icon = ICONS[icon] ?? Award
  const disc = unlocked
    ? `radial-gradient(circle at 30% 25%, color-mix(in srgb, ${color} 55%, #fff) 0%, ${color} 45%, color-mix(in srgb, ${color} 55%, #000) 100%)`
    : 'radial-gradient(circle at 30% 25%, var(--surface-3) 0%, var(--fill-strong) 60%, var(--fill) 100%)'
  return (
    <span
      aria-hidden
      className={cn('relative flex flex-none items-center justify-center rounded-full', className)}
      style={{
        width: size,
        height: size,
        background: disc,
        boxShadow: unlocked
          ? `0 ${size / 12}px ${size / 4}px color-mix(in srgb, ${color} 35%, transparent), inset 0 0 0 ${size / 22}px rgba(255,255,255,0.28), inset 0 -${size / 18}px ${size / 8}px rgba(0,0,0,0.18)`
          : 'inset 0 0 0 1px var(--separator)',
      }}
    >
      <span
        className="absolute rounded-full"
        style={{ inset: size * 0.14, boxShadow: unlocked ? 'inset 0 0 0 1.5px rgba(255,255,255,0.35)' : 'inset 0 0 0 1.5px var(--separator)' }}
      />
      <Icon size={size * 0.38} strokeWidth={2.2} color={unlocked ? '#ffffff' : 'var(--muted)'} style={unlocked ? { filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.25))' } : undefined} />
    </span>
  )
}
