'use client'

import { cn } from '@/lib/cn'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
  className?: string
}

/** iOS-style toggle (51×31). The visible row label should describe it; `label` names it for AT. */
export function Switch({ checked, onChange, label, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-[31px] w-[51px] flex-none items-center rounded-full p-[2px] transition-colors duration-200 disabled:opacity-40',
        checked ? 'bg-[var(--success-fill)]' : 'bg-[var(--surface-3)]',
        className
      )}
    >
      <span
        aria-hidden
        className="h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_3px_1px_rgba(0,0,0,0.06)] transition-transform duration-200 ease-[cubic-bezier(.2,.8,.2,1)]"
        style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
      />
    </button>
  )
}
