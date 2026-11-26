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

export type CookieSettingsProps = {
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
 * Layout particle: reopen Cookie settings after a consent choice exists.
 * Hidden until the client can read `sf-consent` and a decision is stored.
 */
export function CookieSettings({
  privacyUrl = '',
  privacyLinkLabel = '',
  cookieDomain = '',
  cookiePath = '/',
}: CookieSettingsProps) {
  const t = useTranslations('product:consent')
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

  if (consentState !== 'decided') return null

  return (
    <div className="sf-consent-settings" data-sf-particle="cookie-settings">
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
