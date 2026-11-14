'use client'

import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { buttonClasses, type ButtonSize, type ButtonVariant } from '@/components/ui/buttonStyles'

export { buttonClasses, type ButtonSize, type ButtonVariant }

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', children, ...props }, ref) => (
    <button ref={ref} type={type} className={buttonClasses({ variant, size, className })} {...props}>
      {children}
    </button>
  )
)

Button.displayName = 'Button'
