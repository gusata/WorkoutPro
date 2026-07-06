'use client'

import { cn } from '@/lib/cn'

interface BadgeProps {
  children: React.ReactNode
  color?: string
  className?: string
  size?: 'sm' | 'md'
}

export function Badge({ children, color, className, size = 'md' }: BadgeProps) {
  const sizes = { sm: 'px-1.5 py-0.5 text-xs', md: 'px-2.5 py-1 text-xs' }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold',
        sizes[size],
        !color && 'bg-[var(--surface-2)] text-[var(--muted-strong)]',
        className
      )}
      style={
        color
          ? {
              background: `${color}20`,
              color: color,
              border: `1px solid ${color}30`,
            }
          : undefined
      }
    >
      {children}
    </span>
  )
}
