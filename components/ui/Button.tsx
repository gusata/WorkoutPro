'use client'

import { motion } from 'framer-motion'
import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none select-none'

    const variants = {
      primary:   'bg-[var(--accent)] hover:brightness-95 text-white font-bold shadow-lg',
      secondary: 'bg-[var(--surface-2)] hover:brightness-95 text-[var(--foreground)] border border-[var(--border)]',
      ghost:     'hover:bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground)]',
      danger:    'bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 border border-rose-500/20',
      outline:   'border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-2)]',
    }

    const sizes = {
      sm: 'h-9 px-4 text-sm',
      md: 'h-11 px-5 text-sm',
      lg: 'h-12 px-7 text-base',
      icon: 'h-11 w-11 text-sm',
    }

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.95 }}
        className={cn(base, variants[variant], sizes[size], className)}
        {...(props as object)}
      >
        {children}
      </motion.button>
    )
  }
)

Button.displayName = 'Button'
