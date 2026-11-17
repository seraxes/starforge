import 'server-only'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listPlans } from '../store'
import type { SubscriptionPlanRecord } from '../types'

export type PlansCatalogMoney = {
  currency: string
  methods: string[]
  formatMoney: (major: number) => string
}

/** Active plans for the public catalog / particle (optional subject filter + limit). */
export async function loadPublicPlans(opts?: {
  subject?: string
  limit?: number
}): Promise<SubscriptionPlanRecord[]> {
  const subject = (opts?.subject || '').trim()
  const plans = await listPlans({
    activeOnly: true,
    ...(subject ? { subject } : {}),
  })
  const limit =
    opts?.limit != null && Number.isFinite(opts.limit) && opts.limit > 0
      ? Math.min(Math.floor(opts.limit), 48)
      : plans.length
  return plans.slice(0, limit)
}

export async function loadPlansCatalogMoney(): Promise<PlansCatalogMoney> {
  let currency = 'HUF'
  let methods: string[] = ['bank_transfer']
  let formatMoney = (major: number) => `${major} ${currency}`
  try {
    const settings = await getSiteSettings()
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.payments)) {
      return { currency, methods, formatMoney }
    }
    const payments = await import('@/modules/payments/api')
    const pay = await payments.getPaymentsSettings()
    currency = pay.currency || 'HUF'
    methods =
      pay.enabledMethods?.length > 0
        ? [...pay.enabledMethods]
        : ['bank_transfer', 'pay_at_entrance', 'cash']
    formatMoney = (major: number) => {
      const minor = payments.majorToMinor(major, currency)
      if (minor == null) return `${major} ${currency}`
      return payments.formatMoneyMinor(minor, currency)
    }
  } catch {
    /* payments migrate pending */
  }
  return { currency, methods, formatMoney }
}
