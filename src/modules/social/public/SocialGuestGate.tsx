import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import React from 'react'

/** Signed-out column: one guest copy line + Sign in CTA. */
export async function SocialGuestGate({
  loginHref,
  copyKey,
}: {
  loginHref: string
  copyKey:
    | 'guestSignInFeed'
    | 'guestSignInPeople'
    | 'guestSignInFollowing'
    | 'guestSignInDiscover'
    | 'guestSignInSaved'
    | 'guestSignInStories'
    | 'guestSignInWatch'
}) {
  const t = await getTranslations('product:social')
  return (
    <div className="sf-social-feed-column">
      <p className="sf-social-feed-guest-copy">{t(copyKey)}</p>
      <p className="sf-social-feed-guest-action">
        <Link className="sf-social-cta" href={loginHref}>
          {t('signIn')}
        </Link>
      </p>
    </div>
  )
}
