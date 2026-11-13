'use client'

import { X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'full'
  /** Accessible name when there is no visible title. */
  ariaLabel?: string
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  full: 'max-w-full h-full',
}

let openModals = 0

export function Modal({ open, onClose, title, children, size = 'md', ariaLabel }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    openModals += 1
    document.body.style.overflow = 'hidden'

    const dialog = dialogRef.current
    // Focus the dialog itself: screen readers announce its title, and mobile
    // keyboards don't pop up over the sheet before the user picks a field.
    dialog?.focus({ preventScroll: true })

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((item) => item.offsetParent !== null)
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (event.shiftKey && (document.activeElement === firstItem || document.activeElement === dialog)) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault()
        firstItem.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      openModals -= 1
      if (openModals === 0) document.body.style.overflow = ''
      previouslyFocused?.focus?.({ preventScroll: true })
    }
  }, [open])

  if (!open) return null

  return (
    <>
      <div className="backdrop-enter fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`sheet-enter fixed bottom-0 left-0 right-0 z-50 mx-auto max-h-[92vh] w-full overflow-y-auto ${sizes[size]} rounded-t-[28px] px-6 pb-safe pt-2 outline-none sm:bottom-6 sm:rounded-[28px] sm:p-7`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel ?? 'Janela'}
        style={{ background: 'var(--background-elevated)', boxShadow: 'var(--shadow-float)' }}
      >
        <div className="mx-auto mb-3 h-[5px] w-9 rounded-full bg-[var(--fill-strong)] sm:hidden" aria-hidden />
        {(
          <div className={`flex items-center gap-3 ${title ? 'mb-5 justify-between' : 'justify-end'}`}>
            {title && <h2 id={titleId} className="title-2 text-[var(--foreground)]">{title}</h2>}
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 flex h-11 w-11 flex-none items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label="Fechar"
            >
              <span aria-hidden className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[var(--fill-strong)] text-[var(--muted-strong)]">
                <X size={15} strokeWidth={2.6} />
              </span>
            </button>
          </div>
        )}
        {children}
      </div>
    </>
  )
}

export function BottomSheet({ open, onClose, title, children }: ModalProps) {
  return <Modal open={open} onClose={onClose} title={title} size="md">{children}</Modal>
}
