import type { LayoutSlotConfig } from '@/core/modules/types'

import { PLAN_SUBJECTS } from '../types'

export type SubscriptionPlansParticleConfig = {
  heading: string
  emptyMessage: string
  /** Empty = all active plans. Otherwise a plan `subject` filter. */
  subject: string
  limit: number
  showDescription: boolean
}

const SUBJECT_ALLOW = new Set<string>([
  '',
  PLAN_SUBJECTS.membership,
  PLAN_SUBJECTS.organizer,
  PLAN_SUBJECTS.advertisement,
  PLAN_SUBJECTS.other,
])

export function defaultSubscriptionPlansConfig(): SubscriptionPlansParticleConfig {
  return {
    heading: 'Plans',
    emptyMessage: 'No plans are for sale yet.',
    subject: '',
    limit: 12,
    showDescription: true,
  }
}

export function readSubscriptionPlansConfig(
  config: LayoutSlotConfig | undefined,
): SubscriptionPlansParticleConfig {
  const c = config ?? {}
  const defaults = defaultSubscriptionPlansConfig()
  const limitRaw = typeof c.limit === 'number' ? c.limit : Number(c.limit)
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.floor(limitRaw), 48)
      : defaults.limit
  const subjectRaw = typeof c.subject === 'string' ? c.subject.trim() : ''
  const subject = SUBJECT_ALLOW.has(subjectRaw) ? subjectRaw : defaults.subject
  return {
    heading: typeof c.heading === 'string' ? c.heading : defaults.heading,
    emptyMessage:
      typeof c.emptyMessage === 'string' && c.emptyMessage.trim()
        ? c.emptyMessage.trim()
        : defaults.emptyMessage,
    subject,
    limit,
    showDescription: !(c.showDescription === false || c.showDescription === 'false'),
  }
}
