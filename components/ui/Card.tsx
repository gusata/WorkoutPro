'use client'

import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  pressable?: boolean
  /** Translucent material instead of the opaque tile background. */
  glass?: boolean
}

/** Flat apple.com tile. */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, pressable, glass, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'overflow-hidden rounded-[var(--radius-lg)]',
        glass ? 'glass' : 'bg-[var(--surface)]',
        pressable && 'pressable cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)

Card.displayName = 'Card'
