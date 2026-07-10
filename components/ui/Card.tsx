'use client'

import { type HTMLAttributes, type CSSProperties, forwardRef } from 'react'
import { cn } from '@/lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: string
  pressable?: boolean
  glass?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, glow, pressable, glass, children, style, ...props }, ref) => {
    const base = 'overflow-hidden'

    const cardStyle: CSSProperties = glass
      ? {
          background: 'var(--glass)',
          border: '1px solid color-mix(in srgb, var(--border) 84%, white 16%)',
          backdropFilter: 'blur(16px) saturate(140%)',
          WebkitBackdropFilter: 'blur(16px) saturate(140%)',
          boxShadow: 'var(--shadow-soft), inset 0 1px 0 rgba(255,255,255,0.24), inset 0 -1px 0 rgba(31,32,36,0.035)',
        }
      : {
          background: 'var(--glass-strong)',
          border: '1px solid var(--border)',
          backdropFilter: 'blur(12px) saturate(130%)',
          WebkitBackdropFilter: 'blur(12px) saturate(130%)',
          boxShadow: 'var(--shadow-soft), inset 0 1px 0 rgba(255,255,255,0.16)',
        }

    cardStyle.borderRadius = 'var(--card-radius)'

    if (glow) {
      cardStyle.boxShadow = `0 18px 50px ${glow}18, inset 0 1px 0 rgba(255,255,255,0.18)`
    }

    const combined: CSSProperties = { ...cardStyle, ...style }

    if (pressable) {
      return (
        <div
          ref={ref}
          className={cn(base, 'cursor-pointer transition-colors', className)}
          style={combined}
          {...props}
        >
          {children}
        </div>
      )
    }

    return (
      <div ref={ref} className={cn(base, className)} style={combined} {...props}>
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'
