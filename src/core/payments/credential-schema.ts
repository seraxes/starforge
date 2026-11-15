import type { PaymentMethodDescriptor } from './adapter'

export type MerchantCredentialReadyRow = {
  kind: string
  hasSecret: boolean
  meta?: Record<string, unknown>
}

export type MerchantCredentialWrite = {
  kind: string
  secretPlain?: string
  meta?: Record<string, string>
}

type OfflineReadyProfile = {
  bankIban: string
  entranceInstructions: string
  cashInstructions: string
}

/** Fixed offline blocks. Returns null when `method` is not one of them. */
export function offlineMerchantMethodReady(
  method: string,
  profile: OfflineReadyProfile,
): boolean | null {
  if (method === 'bank_transfer') return profile.bankIban.trim().length > 0
  if (method === 'pay_at_entrance') return profile.entranceInstructions.trim().length > 0
  if (method === 'cash') return profile.cashInstructions.trim().length > 0
  return null
}

/**
 * Offer-ready from the adapter credential schema.
 * Every field marked requiredForReady must be saved. Webhook secrets stay optional
 * unless the schema says otherwise.
 */
export function paymentMethodCredentialsReady(
  descriptor: Pick<PaymentMethodDescriptor, 'credentialSchema'>,
  credentials: MerchantCredentialReadyRow[],
): boolean {
  const required = descriptor.credentialSchema.fields.filter((field) => field.requiredForReady)
  if (required.length === 0) return false
  return required.every((field) => {
    const row = credentials.find((item) => item.kind === field.kind)
    if (field.bind === 'secret') return Boolean(row?.hasSecret)
    return String(row?.meta?.[field.metaKey || ''] ?? '').trim().length > 0
  })
}

/**
 * Non-empty merchant form fields → encrypted credential rows.
 * Blank secrets are omitted so the store keeps the existing ciphertext.
 * Meta is replaced only with the keys that were submitted non-empty.
 */
export function credentialWritesFromForm(
  descriptor: Pick<PaymentMethodDescriptor, 'credentialSchema'>,
  read: (name: string) => string,
): MerchantCredentialWrite[] {
  const grouped = new Map<string, { secretPlain?: string; meta: Record<string, string> }>()
  for (const field of descriptor.credentialSchema.fields) {
    const value = read(field.name).trim()
    if (!value) continue
    let bucket = grouped.get(field.kind)
    if (!bucket) {
      bucket = { meta: {} }
      grouped.set(field.kind, bucket)
    }
    if (field.bind === 'secret') bucket.secretPlain = value
    else if (field.metaKey) bucket.meta[field.metaKey] = value
  }

  const writes: MerchantCredentialWrite[] = []
  for (const [kind, bucket] of grouped) {
    const meta = Object.keys(bucket.meta).length > 0 ? bucket.meta : undefined
    if (!bucket.secretPlain && !meta) continue
    writes.push({ kind, secretPlain: bucket.secretPlain, meta })
  }
  return writes
}
