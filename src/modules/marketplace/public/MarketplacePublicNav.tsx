import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import React from 'react'

import { withLocalePrefix } from '@/core/i18n/path'
import type { AppLocale } from '@/core/i18n'

type Props = {
  locale: AppLocale | string
  active: 'browse' | 'new' | 'you'
  signedIn: boolean
}

/** Compact public nav for Marketplace browse / create / you. */
export async function MarketplacePublicNav({ locale, active, signedIn }: Props) {
  const loc = locale as AppLocale
  const t = await getTranslations('product:marketplace')
  return (
    <nav className="sf-marketplace-nav" aria-label={t('navAria')}>
      <Link
        href={withLocalePrefix('/marketplace', loc)}
        className={`sf-marketplace-nav-link${active === 'browse' ? ' is-active' : ''}`}
      >
        {t('navBrowse')}
      </Link>
      {signedIn ? (
        <>
          <Link
            href={withLocalePrefix('/marketplace/new', loc)}
            className={`sf-marketplace-nav-link${active === 'new' ? ' is-active' : ''}`}
          >
            {t('navSell')}
          </Link>
          <Link
            href={withLocalePrefix('/marketplace/you', loc)}
            className={`sf-marketplace-nav-link${active === 'you' ? ' is-active' : ''}`}
          >
            {t('navYou')}
          </Link>
        </>
      ) : (
        <Link
          href={withLocalePrefix('/login?next=/marketplace/new', loc)}
          className="sf-marketplace-nav-link"
        >
          {t('navSignInToSell')}
        </Link>
      )}
    </nav>
  )
}
