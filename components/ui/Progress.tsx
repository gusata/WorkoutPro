'use client'

import { cn } from '@/lib/cn'

interface ProgressProps {
  value: number
  max?: number
  color?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

export function Progress({ value, max = 100, color = 'var(--accent)', className, size = 'md', label }: ProgressProps) {
  const pct = Math.min((value / max) * 100, 100)

  const heights = { sm: 'h-1', md: 'h-2', lg: 'h-3' }

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className="flex justify-between text-xs text-zinc-500 mb-1">
          <span>{label}</span>
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <div className={cn('w-full rounded-full overflow-hidden', heights[size])} style={{ background: 'var(--surface-3)' }}>
        <div
          className="h-full rounded-full"
          style={{ background: color, width: `${pct}%`, transition: 'width 320ms ease-out' }}
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
  color = 'var(--accent)',
  children,
}: CircularProgressProps) {
  const pct = Math.min((value / max) * 100, 100)
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={strokeWidth} />
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
          style={{ transition: 'stroke-dashoffset 320ms ease-out' }}
        />
      </svg>
      {children && <div className="absolute">{children}</div>}
    </div>
  )
}
