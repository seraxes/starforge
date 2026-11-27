/**
 * Pure valid-until / document-slot rules.
 * Store and unit tests call these without DB.
 *
 * Missing = empty date (not expired).
 * Expired = a date in the past.
 * Presence-only import → empty valid-until.
 */

export const ONBOARDING_DOCUMENT_KINDS = [
  'driving_licence',
  'health_booklet',
  'contract',
] as const

export type OnboardingDocumentKind = (typeof ONBOARDING_DOCUMENT_KINDS)[number]

export const ONBOARDING_DOCUMENT_KIND_LABELS: Record<OnboardingDocumentKind, string> = {
  driving_licence: 'Driving licence',
  health_booklet: 'Health booklet',
  contract: 'Contract',
}

function asTrimmed(raw: unknown): string {
  return String(raw ?? '').trim()
}

/** YYYY-MM-DD calendar day, or empty. */
const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isOnboardingDocumentKind(value: unknown): value is OnboardingDocumentKind {
  return (
    typeof value === 'string' &&
    (ONBOARDING_DOCUMENT_KINDS as readonly string[]).includes(value)
  )
}

/**
 * Normalize a valid-until input.
 * Empty / null / whitespace → empty string (missing).
 * Non-empty must be YYYY-MM-DD with a real calendar day.
 */
export function normalizeValidUntilDate(
  raw: unknown,
): { ok: true; validUntil: string } | { ok: false; error: string } {
  const value = asTrimmed(raw)
  if (!value) return { ok: true, validUntil: '' }
  const match = YMD_RE.exec(value)
  if (!match) {
    return { ok: false, error: 'Valid-until must be a YYYY-MM-DD date or empty.' }
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return { ok: false, error: 'Valid-until must be a real calendar day.' }
  }
  return { ok: true, validUntil: value }
}

/** Empty valid-until is missing. */
export function isValidUntilMissing(validUntil: unknown): boolean {
  return asTrimmed(validUntil) === ''
}

function todayYmd(asOf?: Date): string {
  const d = asOf ?? new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * A date in the past is expired.
 * Empty is missing — not expired.
 * Today and future dates are not expired.
 */
export function isValidUntilExpired(validUntil: unknown, asOf?: Date): boolean {
  const value = asTrimmed(validUntil)
  if (!value) return false
  const normalized = normalizeValidUntilDate(value)
  if (!normalized.ok) return false
  return normalized.validUntil < todayYmd(asOf)
}

/** Display state for the person card. */
export type ValidUntilState = 'missing' | 'expired' | 'valid'

export function validUntilState(validUntil: unknown, asOf?: Date): ValidUntilState {
  if (isValidUntilMissing(validUntil)) return 'missing'
  if (isValidUntilExpired(validUntil, asOf)) return 'expired'
  return 'valid'
}

/**
 * Presence-only import: a row may exist with an empty valid-until.
 * Empty is missing, not expired.
 */
export function presenceOnlyValidUntil(): string {
  return ''
}

export type DocumentSlotFieldInput = {
  userId?: unknown
  kind?: unknown
  mediaId?: unknown
  validUntil?: unknown
}

export type DocumentSlotFieldValues = {
  userId: string
  kind: OnboardingDocumentKind
  mediaId: string
  validUntil: string
}

export function validateDocumentSlotFields(
  input: DocumentSlotFieldInput,
): { ok: true; values: DocumentSlotFieldValues } | { ok: false; error: string } {
  const userId = asTrimmed(input.userId)
  if (!userId) return { ok: false, error: 'User id is required.' }

  const kindRaw = asTrimmed(input.kind)
  if (!isOnboardingDocumentKind(kindRaw)) {
    return {
      ok: false,
      error: 'Document kind must be driving_licence, health_booklet, or contract.',
    }
  }

  const date = normalizeValidUntilDate(input.validUntil)
  if (!date.ok) return date

  return {
    ok: true,
    values: {
      userId,
      kind: kindRaw,
      mediaId: asTrimmed(input.mediaId),
      validUntil: date.validUntil,
    },
  }
}

export type PersonValidUntilInput = {
  userId?: unknown
  drivingLicenceValidUntil?: unknown
  healthBookletValidUntil?: unknown
  contractValidUntil?: unknown
  drivingLicenceMediaId?: unknown
  healthBookletMediaId?: unknown
  contractMediaId?: unknown
}

export type PersonValidUntilValues = {
  userId: string
  slots: Array<{
    kind: OnboardingDocumentKind
    mediaId: string
    validUntil: string
  }>
}

/** Validate the three person-card dates in one submit. */
export function validatePersonValidUntilFields(
  input: PersonValidUntilInput,
): { ok: true; values: PersonValidUntilValues } | { ok: false; error: string } {
  const userId = asTrimmed(input.userId)
  if (!userId) return { ok: false, error: 'User id is required.' }

  const triples: Array<{
    kind: OnboardingDocumentKind
    validUntil: unknown
    mediaId: unknown
  }> = [
    {
      kind: 'driving_licence',
      validUntil: input.drivingLicenceValidUntil,
      mediaId: input.drivingLicenceMediaId,
    },
    {
      kind: 'health_booklet',
      validUntil: input.healthBookletValidUntil,
      mediaId: input.healthBookletMediaId,
    },
    {
      kind: 'contract',
      validUntil: input.contractValidUntil,
      mediaId: input.contractMediaId,
    },
  ]

  const slots: PersonValidUntilValues['slots'] = []
  for (const row of triples) {
    const date = normalizeValidUntilDate(row.validUntil)
    if (!date.ok) {
      return {
        ok: false,
        error: `${ONBOARDING_DOCUMENT_KIND_LABELS[row.kind]}: ${date.error}`,
      }
    }
    slots.push({
      kind: row.kind,
      mediaId: asTrimmed(row.mediaId),
      validUntil: date.validUntil,
    })
  }

  return { ok: true, values: { userId, slots } }
}
