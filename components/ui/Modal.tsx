'use client'

import { X } from 'lucide-react'
import { useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'full'
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    full: 'max-w-full h-full',
  }

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 mx-auto w-full ${sizes[size]} rounded-t-3xl p-6 pb-safe`}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'Modal'}
        style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
      >
        {title && (
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-[var(--foreground)]">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 hover:bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label="Fechar"
            >
              <X size={18} />
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
