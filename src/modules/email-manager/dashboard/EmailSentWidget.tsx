import React from 'react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { coreAdminPath } from '@/core/admin-paths'
import { DashboardBars } from '@/core/dashboard/charts/DashboardCharts'
import { DASH_SERIES, formatCount } from '@/core/dashboard/charts/series'
import { DashboardSoftPlaceholder } from '@/core/dashboard/widgets/DashboardSoftPlaceholder'

import { EMAIL_DASHBOARD_TYPES, loadEmailSentStats } from './email-stats'

/**
 * product:email-manager Dashboard card — sent total plus type bars.
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

  const byType = result.data.byType
  const bars = [
    { key: 'transactional', color: DASH_SERIES[0] },
    { key: 'marketing', color: DASH_SERIES[2] },
    { key: 'system', color: DASH_SERIES[3] },
  ] as const

  return (
    <div className="sf-dashboard-email" aria-label={t('sentAriaLabel')}>
      <p className="sf-dash-headline">
        <strong>{formatCount(byType.total ?? 0)}</strong>
        <span>sent</span>
      </p>
      <DashboardBars
        rows={bars.map((bar) => {
          const entry = EMAIL_DASHBOARD_TYPES.find((item) => item.key === bar.key)
          return {
            label: entry?.label ?? bar.key,
            value: byType[bar.key] ?? 0,
            color: bar.color,
          }
        })}
      />
      <p className="sf-dashboard-card-foot">
        <Link href={coreAdminPath('/email')}>{t('openManager')}</Link>
      </p>
    </div>
  )
}

export default EmailSentWidget
