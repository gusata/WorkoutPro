'use client'

import { type InputHTMLAttributes, useState } from 'react'
import { formatDecimal, parseDecimal } from '@/lib/utils'

interface DecimalInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'> {
  value: number | null | undefined
  onValueChange: (value: number) => void
  min?: number
  max?: number
  /** Integers only (reps, RIR, sets). */
  integer?: boolean
}

/**
 * Numeric field that works with the pt-BR keyboard: accepts "22,5" and "22.5",
 * lets the field be empty while typing (instead of snapping to 0) and restores
 * the last valid value on blur.
 */
export function DecimalInput({ value, onValueChange, min = 0, max, integer = false, onFocus, onBlur, ...props }: DecimalInputProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const pattern = integer ? /^\d*$/ : /^\d*([.,]\d{0,2})?$/

  return (
    <input
      {...props}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      autoComplete="off"
      enterKeyHint="done"
      value={draft ?? formatDecimal(value)}
      onFocus={(event) => {
        // Selecting lets the user overwrite the pre-filled value with one tap.
        event.currentTarget.select()
        onFocus?.(event)
      }}
      onChange={(event) => {
        const text = event.target.value
        if (!pattern.test(text.trim())) return
        setDraft(text)
        const parsed = parseDecimal(text)
        if (parsed == null) return
        const clamped = Math.max(min, max != null ? Math.min(max, parsed) : parsed)
        onValueChange(integer ? Math.round(clamped) : clamped)
      }}
      onBlur={(event) => {
        setDraft(null)
        onBlur?.(event)
      }}
    />
  )
}
