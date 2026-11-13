'use client'

import { cn } from '@/lib/cn'

interface ProgressProps {
  value: number
  max?: number
  color?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  label?: string
  /** Accessible name when no visible label is rendered. */
  ariaLabel?: string
}

export function Progress({ value, max = 100, color = 'var(--accent)', className, size = 'md', label, ariaLabel }: ProgressProps) {
  const pct = max > 0 ? Math.max(0, Math.min((value / max) * 100, 100)) : 0

  const heights = { sm: 'h-1', md: 'h-1.5', lg: 'h-2.5' }

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className="mb-1 flex justify-between text-xs text-[var(--muted)]">
          <span>{label}</span>
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-label={ariaLabel ?? label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        className={cn('w-full rounded-full overflow-hidden', heights[size])}
        style={{ background: 'var(--fill-strong)' }}
      >
        <div
          className="h-full rounded-full"
          style={{ background: color, width: `${pct}%`, transition: 'width 600ms cubic-bezier(.25,.1,.25,1)' }}
        />
      </div>
    </div>
  )
}

interface CircularProgressProps {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  color?: string
  children?: React.ReactNode
}

export function CircularProgress({
  value,
  max = 100,
  size = 80,
  strokeWidth = 6,
  color = 'var(--accent-fill)',
  children,
}: CircularProgressProps) {
  const pct = max > 0 ? Math.max(0, Math.min((value / max) * 100, 100)) : 0
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.18} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 160ms ease-out' }}
        />
      </svg>
      {children && <div className="absolute">{children}</div>}
    </div>
  )
}
