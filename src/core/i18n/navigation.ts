import { createNavigation } from 'next-intl/navigation'

import { routing } from './routing'

/**
 * Locale-aware navigation helpers for public UI.
 * Modules should import from `@/core/i18n` (not `next-intl` directly) for Link/redirect.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
