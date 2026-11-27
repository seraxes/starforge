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
    <nav className="gantry-layouts-nav" aria-label="Marketplace">
      <div className="gantry-layouts-nav-tabs">
        <Link
          href={withLocalePrefix('/marketplace', loc)}
          className={`gantry-layouts-nav-tab${active === 'browse' ? ' is-active' : ''}`}
        >
          Browse
        </Link>
        {signedIn ? (
          <>
            <Link
              href={withLocalePrefix('/marketplace/new', loc)}
              className={`gantry-layouts-nav-tab${active === 'new' ? ' is-active' : ''}`}
            >
              Sell
            </Link>
            <Link
              href={withLocalePrefix('/marketplace/you', loc)}
              className={`gantry-layouts-nav-tab${active === 'you' ? ' is-active' : ''}`}
            >
              Your listings
            </Link>
          </>
        ) : (
          <Link
            href={withLocalePrefix('/login?next=/marketplace/new', loc)}
            className="gantry-layouts-nav-tab"
          >
            Sign in to sell
          </Link>
        )}
      </div>
    </nav>
  )
}
