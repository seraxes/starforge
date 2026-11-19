import React from 'react'
import { getLocale } from 'next-intl/server'

import { getAppSession } from '@/core/auth/session'
import { isAppLocale } from '@/core/i18n/locales'
import type { StarforgeModule } from '@/core/modules/types'
import { MODULE_IDS, isCatalogModuleEnabled } from '@/core/settings'

import { PlansCatalog } from '../public/PlansCatalog'
import { loadPlansCatalogMoney, loadPublicPlans } from '../public/load-plans-catalog'
import { loadPlanHoldNotices } from '../store'
import { readSubscriptionPlansConfig } from './subscription-plans-config'

/**
 * subscription-plans particle — active plan mosaic with subscribe CTA.
 * Place on any layout / brochure page. Needs product:subscriptions.
 */
export const subscriptionPlansModule: StarforgeModule = {
  id: 'subscription-plans',
  name: 'Subscription plans',
  description: 'Public plan catalog with subscribe CTA from product:subscriptions.',
  defaultWidth: 100,
  navViews: [{ key: 'plans', label: 'Plans', href: '/plans' }],
  render: async ({ slot, settings }) => {
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.subscriptions)) {
      return null
    }

    const cfg = readSubscriptionPlansConfig(slot.config)
    const localeRaw = await getLocale()
    const locale = isAppLocale(localeRaw) ? localeRaw : 'en'
    const session = await getAppSession()
    const userId = session?.user?.id ? String(session.user.id).trim() : ''

    const [plans, money, holds] = await Promise.all([
      loadPublicPlans({
        subject: cfg.subject || undefined,
        limit: cfg.limit,
      }),
      loadPlansCatalogMoney(),
      userId ? loadPlanHoldNotices(userId, locale) : Promise.resolve({}),
    ])

    return React.createElement(PlansCatalog, {
      plans,
      locale,
      signedIn: Boolean(session?.user?.id),
      currency: money.currency,
      methods: money.methods,
      formatMoney: money.formatMoney,
      heading: cfg.heading,
      emptyMessage: cfg.emptyMessage,
      showDescription: cfg.showDescription,
      className: 'sf-subscription-plans-particle',
      showAccountLink: true,
      holds,
    })
  },
}
