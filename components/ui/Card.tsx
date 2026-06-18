'use client'

import { motion } from 'framer-motion'
import { type HTMLAttributes, type CSSProperties, forwardRef } from 'react'
import { cn } from '@/lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: string
  pressable?: boolean
  glass?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, glow, pressable, glass, children, style, ...props }, ref) => {
    const base = cn('rounded-2xl overflow-hidden', glass ? 'backdrop-blur-2xl' : '')

    const cardStyle: CSSProperties = glass
      ? {
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.09)',
        }
      : {
          background: '#111113',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }

    if (glow) {
      cardStyle.boxShadow = `0 0 0 1px ${glow}18, 0 8px 40px ${glow}14`
    }

    const combined: CSSProperties = { ...cardStyle, ...style }

    if (pressable) {
      return (
        <motion.div
          ref={ref}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.97 }}
          className={cn(base, 'cursor-pointer', className)}
          style={combined}
          {...(props as object)}
        >
          {children}
        </motion.div>
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
