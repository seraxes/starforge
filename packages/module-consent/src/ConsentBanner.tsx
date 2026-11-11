'use client'

import React, { useState, useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'

import { ConsentChoicesPanel } from './ConsentChoicesPanel'
import {
  buildConsentPreferences,
  readConsentFromDocumentCookie,
  writeConsentCookie,
} from './cookie'
import {
  CONSENT_EVENT,
  type ConsentChangeDetail,
  type ConsentPreferences,
} from './types'

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

type ConsentUiState = 'pending' | 'undecided' | 'decided'

function readConsentUiState(): ConsentUiState {
  return readConsentFromDocumentCookie() === null ? 'undecided' : 'decided'
}

/**
 * Fixed sitewide consent bar + choices panel + Cookie settings reopen.
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
  // SSR + hydration: hide until client can read sf-consent.
  const consentState = useSyncExternalStore(
    subscribeConsent,
    readConsentUiState,
    () => 'pending' as ConsentUiState,
  )
  const [panelOpen, setPanelOpen] = useState(false)
  const [analyticsDraft, setAnalyticsDraft] = useState(false)

  function persist(analytics: boolean) {
    const preferences = buildConsentPreferences({ analytics })
    writeConsentCookie(preferences, { path: cookiePath, domain: cookieDomain })
    dispatchConsentChange(preferences)
    setPanelOpen(false)
  }

  function openPanel() {
    const current = readConsentFromDocumentCookie()
    setAnalyticsDraft(current?.analytics ?? false)
    setPanelOpen(true)
  }

  const trimmedPrivacy = privacyUrl.trim()
  const linkLabel = privacyLinkLabel.trim() || t('privacyPolicy')

  if (panelOpen) {
    return (
      <ConsentChoicesPanel
        analytics={analyticsDraft}
        onAnalyticsChange={setAnalyticsDraft}
        onSave={() => persist(analyticsDraft)}
        onCancel={() => setPanelOpen(false)}
        privacyUrl={privacyUrl}
        privacyLinkLabel={privacyLinkLabel}
      />
    )
  }

  if (consentState === 'pending') return null

  if (consentState === 'decided') {
    return (
      <div className="sf-consent-settings">
        <button
          type="button"
          className="sf-consent-banner-btn sf-consent-banner-btn-secondary sf-consent-settings-btn"
          onClick={openPanel}
        >
          {t('cookieSettings')}
        </button>
      </div>
    )
  }

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
            className="sf-consent-banner-btn sf-consent-banner-btn-secondary"
            onClick={openPanel}
          >
            {t('customize')}
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
