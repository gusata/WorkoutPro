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
      'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none select-none'

    const variants = {
      primary:   'bg-[#00c896] hover:bg-[#00b386] text-[#080809] font-bold shadow-lg shadow-[#00c896]/20',
      secondary: 'bg-white/8 hover:bg-white/12 text-white border border-white/8',
      ghost:     'hover:bg-white/8 text-zinc-400 hover:text-white',
      danger:    'bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/20',
      outline:   'border border-white/10 text-white hover:bg-white/5',
    }

    const sizes = {
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-4 text-sm',
      lg: 'h-12 px-6 text-base',
      icon: 'h-10 w-10 text-sm',
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
