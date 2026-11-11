'use client'

import React from 'react'
import { useTranslations } from 'next-intl'

export type ConsentChoicesPanelProps = {
  analytics: boolean
  onAnalyticsChange: (next: boolean) => void
  onSave: () => void
  onCancel: () => void
  privacyUrl?: string
  privacyLinkLabel?: string
}

/**
 * Category choices for Necessary (locked) + Analytics.
 * Shares banner button classes; no marketing/functional categories yet.
 */
export function ConsentChoicesPanel({
  analytics,
  onAnalyticsChange,
  onSave,
  onCancel,
  privacyUrl = '',
  privacyLinkLabel = '',
}: ConsentChoicesPanelProps) {
  const t = useTranslations('product:consent')
  const trimmedPrivacy = privacyUrl.trim()
  const linkLabel = privacyLinkLabel.trim() || t('privacyPolicy')

  return (
    <div className="sf-consent-banner" role="dialog" aria-label={t('choicesDialogLabel')}>
      <div className="sf-consent-banner-inner sf-consent-choices-inner">
        <div className="sf-consent-banner-copy">
          <p className="sf-consent-banner-text">{t('choicesIntro')}</p>
          {trimmedPrivacy ? (
            <p className="sf-consent-banner-privacy">
              <a href={trimmedPrivacy}>{linkLabel}</a>
            </p>
          ) : null}
          <ul className="sf-consent-choices">
            <li className="sf-consent-choice">
              <input
                id="sf-consent-necessary"
                type="checkbox"
                checked
                disabled
                aria-describedby="sf-consent-necessary-hint"
              />
              <div className="sf-consent-choice-meta">
                <label htmlFor="sf-consent-necessary" className="sf-consent-choice-label">
                  {t('necessary')}
                </label>
                <p id="sf-consent-necessary-hint" className="sf-consent-choice-hint">
                  {t('necessaryHint')}
                </p>
              </div>
            </li>
            <li className="sf-consent-choice">
              <input
                id="sf-consent-analytics"
                type="checkbox"
                checked={analytics}
                onChange={(event) => onAnalyticsChange(event.target.checked)}
                aria-describedby="sf-consent-analytics-hint"
              />
              <div className="sf-consent-choice-meta">
                <label htmlFor="sf-consent-analytics" className="sf-consent-choice-label">
                  {t('analytics')}
                </label>
                <p id="sf-consent-analytics-hint" className="sf-consent-choice-hint">
                  {t('analyticsHint')}
                </p>
              </div>
            </li>
          </ul>
        </div>
        <div className="sf-consent-banner-actions">
          <button
            type="button"
            className="sf-consent-banner-btn sf-consent-banner-btn-secondary"
            onClick={onCancel}
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            className="sf-consent-banner-btn sf-consent-banner-btn-primary"
            onClick={onSave}
          >
            {t('saveChoices')}
          </button>
        </div>
      </div>
    </div>
  )
}
