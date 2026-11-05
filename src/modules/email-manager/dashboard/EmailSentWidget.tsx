import React from 'react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { coreAdminPath } from '@/core/admin-paths'
import { DashboardSoftPlaceholder } from '@/core/dashboard/widgets/DashboardSoftPlaceholder'

import { EMAIL_DASHBOARD_TYPES, loadEmailSentStats } from './email-stats'

function dash(n: number | null | undefined): string {
  return n == null ? '—' : String(n)
}

/**
 * product:email-manager Dashboard card — count + type from `sf_email_sends`.
 * Same row chrome as the soft stub; no visual redesign.
 * Thin i18n P3 migrate: footer / soft-fail hint / aria (`product:email-manager`).
 */
export async function EmailSentWidget() {
  const [result, t] = await Promise.all([
    loadEmailSentStats(),
    getTranslations('product:email-manager'),
  ])

  if (!result.ok) {
    return (
      <DashboardSoftPlaceholder
        status={result.status === 'unavailable' ? 'unavailable' : 'soft-fail'}
        hint={t('volumeHint')}
        rows={EMAIL_DASHBOARD_TYPES.map((entry) => ({ label: entry.label, value: '—' }))}
        footerHref={coreAdminPath('/email')}
        footerLabel={t('openManager')}
      />
    )
  }

  return (
    <div className="sf-dashboard-email" aria-label={t('sentAriaLabel')}>
      <dl className="sf-dashboard-placeholder-rows">
        {EMAIL_DASHBOARD_TYPES.map((entry) => (
          <div key={entry.key} className="sf-dashboard-placeholder-row">
            <dt>{entry.label}</dt>
            <dd>{dash(result.data.byType[entry.key])}</dd>
          </div>
        ))}
      </dl>
      <p className="sf-dashboard-card-foot">
        <Link href={coreAdminPath('/email')}>{t('openManager')}</Link>
      </p>
    </div>
  )
}

export default EmailSentWidget
