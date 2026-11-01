import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** shadcn-style className merge — available for admin UI primitives. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
