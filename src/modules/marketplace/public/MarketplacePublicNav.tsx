import Link from 'next/link'
import React from 'react'

import { withLocalePrefix } from '@/core/i18n/path'
import type { AppLocale } from '@/core/i18n'

type Props = {
  locale: AppLocale | string
  active: 'browse' | 'new' | 'you'
  signedIn: boolean
}

/** Compact public nav for Marketplace browse / create / you. */
export function MarketplacePublicNav({ locale, active, signedIn }: Props) {
  const loc = locale as AppLocale
  return (
    <nav className="sf-marketplace-nav" aria-label="Marketplace">
      <Link
        href={withLocalePrefix('/marketplace', loc)}
        className={`sf-marketplace-nav-link${active === 'browse' ? ' is-active' : ''}`}
      >
        Browse
      </Link>
      {signedIn ? (
        <>
          <Link
            href={withLocalePrefix('/marketplace/new', loc)}
            className={`sf-marketplace-nav-link${active === 'new' ? ' is-active' : ''}`}
          >
            Sell
          </Link>
          <Link
            href={withLocalePrefix('/marketplace/you', loc)}
            className={`sf-marketplace-nav-link${active === 'you' ? ' is-active' : ''}`}
          >
            You
          </Link>
        </>
      ) : (
        <Link
          href={withLocalePrefix('/login?next=/marketplace/new', loc)}
          className="sf-marketplace-nav-link"
        >
          Sign in to sell
        </Link>
      )}
    </nav>
  )
}
