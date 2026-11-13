// Server-safe (no 'use client'): usable from Server Components like app/not-found.tsx.
import { cn } from '@/lib/cn'

/**
 * apple.com buttons: blue filled pill (primary), gray pill (secondary), blue outline
 * pill (outline), text link (ghost), tinted and destructive. All >= 44px tall except `sm`.
 */
export type ButtonVariant = 'primary' | 'tinted' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'contrast'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const base =
  'relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-normal tracking-[-0.022em] transition-[background-color,opacity,transform,box-shadow] duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 select-none focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_srgb,var(--accent)_50%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--accent-fill)] text-[var(--on-accent)] hover:bg-[var(--accent-fill-hover)]',
  contrast: 'bg-[var(--foreground)] text-[var(--background-elevated)] hover:opacity-90',
  tinted: 'bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]',
  secondary: 'bg-[var(--fill)] text-[var(--foreground)] hover:bg-[var(--fill-strong)]',
  outline: 'text-[var(--accent)] shadow-[inset_0_0_0_1px_var(--accent)] hover:bg-[var(--accent-soft)]',
  ghost: 'text-[var(--accent)] hover:underline',
  danger: 'bg-[var(--danger-soft)] text-[var(--danger)] hover:brightness-95',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 min-w-11 px-4 text-[15px]',
  md: 'h-11 px-[22px] text-[17px]',
  lg: 'h-[52px] px-7 text-[17px]',
  icon: 'h-11 w-11 p-0',
}

/** Shared classes so a <Link> can look like a button without nesting interactive elements. */
export function buttonClasses({ variant = 'primary', size = 'md', className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className)
}
