'use client'

import { useEffect, useRef } from 'react'
import { Minus, Plus } from 'lucide-react'
import { DecimalInput } from '@/components/ui/DecimalInput'
import { haptic } from '@/lib/haptics'

interface StepperProps {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  max?: number
  unit?: string
}

const HOLD_DELAY = 380
const REPEAT_START = 140
const REPEAT_MIN = 45

/** − value + with hold-to-repeat that speeds up the longer it is held. The value is still typeable. */
export function Stepper({ label, value, onChange, step = 1, min = 1, max = 999, unit }: StepperProps) {
  const current = useRef(value)
  const onChangeRef = useRef(onChange)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { current.current = value }, [value])
  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function bump(direction: -1 | 1) {
    const next = Math.min(max, Math.max(min, current.current + direction * step))
    if (next === current.current) return false
    current.current = next
    onChangeRef.current(next)
    haptic('selection')
    return true
  }

  function stop() {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  function start(direction: -1 | 1, event: React.PointerEvent) {
    if (event.button !== 0) return
    event.preventDefault()
    stop()
    bump(direction)
    let interval = REPEAT_START
    const repeat = () => {
      if (!bump(direction)) return stop()
      interval = Math.max(REPEAT_MIN, interval * 0.86)
      timer.current = setTimeout(repeat, interval)
    }
    timer.current = setTimeout(repeat, HOLD_DELAY)
  }

  const button = (direction: -1 | 1) => (
    <button
      type="button"
      className="stepper-btn"
      disabled={direction < 0 ? value <= min : value >= max}
      onPointerDown={(event) => start(direction, event)}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(event) => event.preventDefault()}
      // Keyboard/screen reader activation (pointer clicks are handled on pointerdown).
      onClick={(event) => { if (event.detail === 0) bump(direction) }}
      aria-label={`${direction < 0 ? 'Diminuir' : 'Aumentar'} ${label.toLowerCase()}`}
    >
      {direction < 0 ? <Minus size={16} strokeWidth={2.6} aria-hidden /> : <Plus size={16} strokeWidth={2.6} aria-hidden />}
    </button>
  )

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--surface)] p-2.5">
      <span className="caption mb-1.5 block px-1 font-semibold text-[var(--muted)]">{label}</span>
      <div className="flex items-center gap-1.5">
        {button(-1)}
        <span className="relative min-w-0 flex-1">
          <DecimalInput
            integer
            min={min}
            max={max}
            value={value}
            onValueChange={onChange}
            aria-label={label}
            className="h-9 w-full rounded-[10px] bg-transparent text-center text-[19px] font-semibold tabular-nums outline-none focus:bg-[var(--fill)]"
          />
          {unit && <span aria-hidden className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[var(--muted)]">{unit}</span>}
        </span>
        {button(1)}
      </div>
    </div>
  )
}
