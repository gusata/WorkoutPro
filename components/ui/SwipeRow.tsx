'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/cn'

export interface SwipeAction {
  label: string
  icon: ReactNode
  onAction: () => void
  tone?: 'danger' | 'accent' | 'neutral'
}

interface SwipeRowProps {
  /** Revealed from the right when the row is swiped left. The first one runs on a full swipe. */
  actions: SwipeAction[]
  children: ReactNode
  className?: string
  contentClassName?: string
  disabled?: boolean
}

const ACTION_WIDTH = 76
const TONES = {
  danger: 'bg-[#ff3b30] text-white',
  accent: 'bg-[var(--accent-fill)] text-white',
  neutral: 'bg-[#8e8e93] text-white',
}

// Only one row stays open at a time, like iOS lists.
let closeOpenRow: (() => void) | null = null

/**
 * iOS-style swipe-to-reveal row. Horizontal drags only: vertical movement is left to the page
 * scroll (body uses touch-action: pan-y). The actions stay reachable without gestures through
 * the row's own buttons/menus, so this is an accelerator, never the only path.
 */
export function SwipeRow({ actions, children, className, contentClassName, disabled }: SwipeRowProps) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; base: number; id: number; locked: 'x' | 'y' | null } | null>(null)
  const moved = useRef(false)
  const armed = useRef(false)
  const [armedView, setArmedView] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)
  const revealWidth = actions.length * ACTION_WIDTH

  function close() { setOffset(0) }

  useEffect(() => {
    if (offset === 0) return
    const self = close
    if (closeOpenRow && closeOpenRow !== self) closeOpenRow()
    closeOpenRow = self
    function onOutside(event: PointerEvent) {
      if (!rowRef.current?.contains(event.target as Node)) setOffset(0)
    }
    document.addEventListener('pointerdown', onOutside)
    return () => {
      document.removeEventListener('pointerdown', onOutside)
      if (closeOpenRow === self) closeOpenRow = null
    }
  }, [offset])

  function onPointerDown(event: React.PointerEvent) {
    if (disabled || event.button !== 0) return
    if ((event.target as HTMLElement).closest('[data-no-swipe], input, textarea, select')) return
    start.current = { x: event.clientX, y: event.clientY, base: offset, id: event.pointerId, locked: null }
    moved.current = false
  }

  function onPointerMove(event: React.PointerEvent) {
    const s = start.current
    if (!s || s.id !== event.pointerId) return
    const dx = event.clientX - s.x
    const dy = event.clientY - s.y
    if (!s.locked) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      s.locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (s.locked === 'x') {
        // Capture on the element that owns the handlers, so moves keep arriving outside it.
        event.currentTarget.setPointerCapture(event.pointerId)
        window.getSelection()?.removeAllRanges()
        setDragging(true)
        moved.current = true
      }
    }
    if (s.locked !== 'x') return
    const raw = s.base + dx
    // Rubber band past the actions and on the closed side.
    const width = rowRef.current?.offsetWidth ?? 320
    const next = raw > 0 ? raw * 0.2 : raw < -revealWidth ? -revealWidth + (raw + revealWidth) * 0.55 : raw
    const full = next < -Math.max(revealWidth + 60, width * 0.55)
    if (full !== armed.current) {
      armed.current = full
      setArmedView(full)
      haptic(full ? 'medium' : 'selection')
    }
    setOffset(Math.max(next, -width))
  }

  function onPointerUp(event: React.PointerEvent) {
    const s = start.current
    start.current = null
    if (!s || s.locked !== 'x') return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    setDragging(false)
    if (armed.current) {
      armed.current = false
      setArmedView(false)
      setOffset(0)
      actions[0]?.onAction()
      return
    }
    setOffset(offset < -revealWidth / 2 ? -revealWidth : 0)
  }

  return (
    <div ref={rowRef} className={cn('relative overflow-hidden', className)}>
      {offset < 0 && (
        <div className="absolute inset-y-0 right-0 flex" style={{ width: Math.max(revealWidth, -offset) }} aria-hidden={offset === 0}>
          {actions.map((action, index) => (
            <button
              key={action.label}
              type="button"
              tabIndex={offset === -revealWidth ? 0 : -1}
              onClick={() => { close(); action.onAction() }}
              className={cn(
                'flex h-full flex-col items-center justify-center gap-1 text-[12px] font-semibold transition-[flex-grow] duration-200',
                TONES[action.tone ?? 'neutral'],
                armedView && index === 0 ? 'grow-[9]' : 'grow',
              )}
              style={{ minWidth: ACTION_WIDTH }}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(event) => {
          // A swipe ends with a click on whatever was under the finger; swallow it.
          if (moved.current) { event.preventDefault(); event.stopPropagation(); moved.current = false }
          else if (offset !== 0) { event.preventDefault(); event.stopPropagation(); close() }
        }}
        className={cn('relative bg-[var(--surface)]', dragging ? 'select-none' : 'transition-transform duration-300 ease-[var(--ease-spring)]', contentClassName)}
        style={{ transform: offset ? `translate3d(${offset}px,0,0)` : undefined }}
      >
        {children}
      </div>
    </div>
  )
}
