import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Minimal shadcn-style Button for Core admin.
 * Orange primary / blue secondary — Gantry-like admin actions.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sf-primary)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--sf-primary)] text-[var(--sf-primary-ink)] border border-[color-mix(in_srgb,var(--sf-primary)_70%,var(--sf-primary-strong))] hover:bg-[color-mix(in_srgb,var(--sf-primary)_82%,var(--sf-primary-strong))]',
        secondary:
          'bg-[color-mix(in_srgb,var(--sf-secondary)_22%,transparent)] text-[var(--sf-secondary-strong)] border border-[color-mix(in_srgb,var(--sf-secondary)_55%,var(--sf-line))] hover:bg-[color-mix(in_srgb,var(--sf-secondary)_32%,transparent)]',
        outline:
          'border border-[var(--sf-line)] bg-transparent text-[var(--sf-ink)] hover:bg-[color-mix(in_srgb,var(--sf-secondary)_14%,transparent)]',
        ghost: 'bg-transparent text-[var(--sf-ink)] hover:bg-[color-mix(in_srgb,var(--sf-secondary)_14%,transparent)]',
        danger:
          'bg-[color-mix(in_srgb,#c45c5c_22%,transparent)] text-[#f0b4b4] border border-[color-mix(in_srgb,#c45c5c_40%,var(--sf-line))]',
      },
      size: {
        default: 'h-9 px-3.5 py-2',
        sm: 'h-8 rounded-md px-2.5 text-xs',
        lg: 'h-10 rounded-md px-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
