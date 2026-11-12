/**
 * Plan type + subtype labels for admin filters.
 * Subtype is stored on `audience` — no second column.
 * Empty player / organizer audiences are the original premiums.
 */

import { PLAN_SUBJECTS } from './types'

export type PlanTypeOption = {
  id: string
  label: string
}

export type PlanSubtypeOption = {
  value: string
  label: string
  title?: string
}

/** Filter chips and the plan subject select. Unknown subjects use the Other bucket. */
export const PLAN_TYPE_OPTIONS: PlanTypeOption[] = [
  { id: PLAN_SUBJECTS.membership, label: 'Players' },
  { id: PLAN_SUBJECTS.organizer, label: 'Organizers' },
  { id: PLAN_SUBJECTS.advertisement, label: 'Advertisements' },
  { id: PLAN_SUBJECTS.other, label: 'Other' },
]

/**
 * Subtypes (`audience`) per subject.
 * Organizer `brand` is a brand that owns a managed page — a page in this
 * system that operates as their website. That page product is later; the
 * subtype is the slot for it.
 */
export const PLAN_SUBTYPES: Record<string, PlanSubtypeOption[]> = {
  [PLAN_SUBJECTS.membership]: [
    { value: 'premium', label: 'Premium' },
    { value: 'premium_plus', label: 'Premium Plus' },
  ],
  [PLAN_SUBJECTS.organizer]: [
    { value: 'organizer', label: 'Organizer' },
    {
      value: 'brand',
      label: 'Brand page',
      title: 'A brand that owns a managed page — a site page that operates as their website.',
    },
  ],
  [PLAN_SUBJECTS.advertisement]: [
    { value: 'organizer', label: 'Organizers' },
    { value: 'marketplace', label: 'Marketplace' },
    { value: 'brand', label: 'Brands' },
    { value: 'shop', label: 'Shops' },
  ],
}

const KNOWN_SUBJECTS = new Set<string>([
  PLAN_SUBJECTS.membership,
  PLAN_SUBJECTS.organizer,
  PLAN_SUBJECTS.advertisement,
])

export function planSubjectBucket(subject: string): string {
  const raw = subject.trim()
  if (KNOWN_SUBJECTS.has(raw)) return raw
  return PLAN_SUBJECTS.other
}

export function planSubjectLabel(subject: string): string {
  const raw = subject.trim()
  const known = PLAN_TYPE_OPTIONS.find((opt) => opt.id === raw)
  if (known) return known.label
  return raw || 'Other'
}

export function subtypesForPlanType(typeId: string): PlanSubtypeOption[] {
  return PLAN_SUBTYPES[typeId] ?? []
}

export function defaultAudienceForSubject(subject: string): string {
  return subtypesForPlanType(subject)[0]?.value ?? ''
}

/** Empty membership / organizer rows are the original premiums. Ads stay explicit. */
export function canonicalPlanAudience(subject: string, audience: string): string {
  const raw = audience.trim()
  if (raw) return raw
  if (subject === PLAN_SUBJECTS.membership) return 'premium'
  if (subject === PLAN_SUBJECTS.organizer) return 'organizer'
  return ''
}

export function planSubtypeLabel(subject: string, audience: string): string {
  const canonical = canonicalPlanAudience(subject, audience)
  if (!canonical) return ''
  const bucket = planSubjectBucket(subject)
  const hit = subtypesForPlanType(bucket).find((opt) => opt.value === canonical)
  return hit?.label ?? canonical
}

export function planTypeSummary(subject: string, audience: string): string {
  const type = planSubjectLabel(subject)
  const sub = planSubtypeLabel(subject, audience)
  return sub ? `${type} · ${sub}` : type
}

export function audienceMatchesSubtype(
  subject: string,
  audience: string,
  subtype: string,
): boolean {
  if (!subtype) return true
  return canonicalPlanAudience(subject, audience) === subtype
}
