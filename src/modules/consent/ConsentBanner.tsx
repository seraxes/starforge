'use client'

import React, { useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'

import {
  CONSENT_EVENT,
  buildConsentPreferences,
  readConsentFromDocumentCookie,
  writeConsentCookie,
  type ConsentChangeDetail,
  type ConsentPreferences,
} from '@/core/consent'

export type ConsentBannerProps = {
  message: string
  privacyUrl?: string
  privacyLinkLabel?: string
  /** Session cookie Domain from Site Chrome (optional). */
  cookieDomain?: string
  /** Session cookie Path from Site Chrome. */
  cookiePath?: string
}

function dispatchConsentChange(preferences: ConsentPreferences): void {
  if (typeof window === 'undefined') return
  const detail: ConsentChangeDetail = { preferences }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail }))
}

function subscribeConsent(onStoreChange: () => void): () => void {
  window.addEventListener(CONSENT_EVENT, onStoreChange)
  return () => window.removeEventListener(CONSENT_EVENT, onStoreChange)
}

function consentIsUndecided(): boolean {
  return readConsentFromDocumentCookie() === null
}

/**
 * Fixed sitewide consent bar. Shown until the visitor chooses.
 * Preference cookie is client-readable so atom:analytics can honor it.
 * Button / aria chrome uses `product:consent` messages (i18n P3).
 */
export function ConsentBanner({
  message,
  privacyUrl = '',
  privacyLinkLabel = '',
  cookieDomain = '',
  cookiePath = '/',
}: ConsentBannerProps) {
  const t = useTranslations('product:consent')
  // SSR + hydration: hide; after hydrate, show only when no sf-consent cookie.
  const undecided = useSyncExternalStore(
    subscribeConsent,
    () => consentIsUndecided(),
    () => false,
  )

  if (!undecided) return null

  function persist(analytics: boolean) {
    const preferences = buildConsentPreferences({ analytics })
    writeConsentCookie(preferences, { path: cookiePath, domain: cookieDomain })
    dispatchConsentChange(preferences)
  }

  const trimmedPrivacy = privacyUrl.trim()
  const linkLabel = privacyLinkLabel.trim() || t('privacyPolicy')

  return (
    <div className="sf-consent-banner" role="dialog" aria-label={t('dialogLabel')}>
      <div className="sf-consent-banner-inner">
        <div className="sf-consent-banner-copy">
          <p className="sf-consent-banner-text">{message}</p>
          {trimmedPrivacy ? (
            <p className="sf-consent-banner-privacy">
              <a href={trimmedPrivacy}>{linkLabel}</a>
            </p>
          ) : null}
        </div>
        <div className="sf-consent-banner-actions">
          <button
            type="button"
            className="sf-consent-banner-btn sf-consent-banner-btn-secondary"
            onClick={() => persist(false)}
          >
            {t('essentialOnly')}
          </button>
          <button
            type="button"
            className="sf-consent-banner-btn sf-consent-banner-btn-primary"
            onClick={() => persist(true)}
          >
            {t('acceptAll')}
          </button>
        </div>
      </div>
    </div>
  )
}
