'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'

interface UndoState {
  id: number
  message: string
  undo: () => void | Promise<void>
}

/** A "Removido · Desfazer" toast. `show` replaces any toast still on screen. */
export function useUndoToast(duration = 5000) {
  const [state, setState] = useState<UndoState | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    setState(null)
  }, [])

  const show = useCallback((message: string, undo: UndoState['undo']) => {
    if (timer.current) clearTimeout(timer.current)
    setState({ id: Date.now(), message, undo })
    timer.current = setTimeout(() => setState(null), duration)
  }, [duration])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const toast = state ? (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-0 right-0 z-50 flex justify-center px-4"
      style={{ bottom: 'calc(var(--tabbar-height) + env(safe-area-inset-bottom) + 0.75rem)' }}
    >
      <div key={state.id} className="toast-enter pointer-events-auto relative flex w-full max-w-sm items-center gap-3 overflow-hidden rounded-full bg-[#1d1d1f] py-1.5 pl-5 pr-1.5 text-[#f5f5f7] shadow-[var(--shadow-float)]">
        <span className="min-w-0 flex-1 truncate text-[15px]">{state.message}</span>
        <button
          type="button"
          onClick={() => { const undo = state.undo; dismiss(); void undo() }}
          className="flex h-10 flex-none items-center gap-1.5 rounded-full bg-white/12 px-4 text-[15px] font-semibold text-[#64b5ff]"
        >
          <RotateCcw size={15} aria-hidden />Desfazer
        </button>
        <span aria-hidden className="undo-countdown absolute bottom-0 left-0 h-[2px] bg-[#64b5ff]" style={{ animationDuration: `${duration}ms` }} />
      </div>
    </div>
  ) : null

  return { show, dismiss, toast }
}
