'use client'

import { type InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'h-11 w-full rounded-xl bg-white/5 border border-white/10 px-4 text-white placeholder:text-zinc-600',
            'focus:outline-none focus:border-indigo-500 focus:bg-white/8 transition-all',
            'text-sm',
            error && 'border-rose-500/50',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className, label, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          className={cn(
            'w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-zinc-600',
            'focus:outline-none focus:border-indigo-500 focus:bg-white/8 transition-all resize-none',
            'text-sm',
            className
          )}
          {...props}
        />
      </div>
    )
  }
)

TextArea.displayName = 'TextArea'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string; label: string }[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, id, options, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={cn(
            'h-11 w-full rounded-xl bg-zinc-900 border border-white/10 px-4 text-white',
            'focus:outline-none focus:border-indigo-500 transition-all',
            'text-sm appearance-none',
            className
          )}
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    )
  }
)

Select.displayName = 'Select'
