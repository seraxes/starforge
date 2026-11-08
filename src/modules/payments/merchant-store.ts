import 'server-only'

import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/core/db'
import type { BillingProviderKind, GatewayCredentials } from '@/core/payments'

import { decryptSecret, encryptSecret, maskSecret } from './credentials-crypto'
import { assertMayCollect } from './entitlement'
import {
  sfPayMerchantCredentials,
  sfPayMerchants,
} from './schema'

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`
}

export type MerchantRecord = {
  id: string
  userId: string
  displayName: string
  status: string
  sellerName: string
  sellerAddress: string
  sellerVatId: string
  bankIban: string
  bankName: string
  bankAccountName: string
  entranceInstructions: string
  cashInstructions: string
  billingProvider: BillingProviderKind
}

export type CredentialPublic = {
  kind: string
  hasSecret: boolean
  masked: string
  meta: Record<string, unknown>
}

export async function getMerchantByUserId(userId: string): Promise<MerchantRecord | null> {
  try {
    const rows = await db
      .select()
      .from(sfPayMerchants)
      .where(eq(sfPayMerchants.userId, userId.trim()))
      .limit(1)
    const row = rows[0]
    if (!row) return null
    return mapMerchant(row)
  } catch {
    return null
  }
}

export async function getMerchantById(merchantId: string): Promise<MerchantRecord | null> {
  try {
    const rows = await db
      .select()
      .from(sfPayMerchants)
      .where(eq(sfPayMerchants.id, merchantId.trim()))
      .limit(1)
    const row = rows[0]
    if (!row) return null
    return mapMerchant(row)
  } catch {
    return null
  }
}

function mapMerchant(row: typeof sfPayMerchants.$inferSelect): MerchantRecord {
  const bp = row.billingProvider
  const billingProvider: BillingProviderKind =
    bp === 'billingo' || bp === 'szamlazz' ? bp : 'noop'
  return {
    id: row.id,
    userId: row.userId,
    displayName: row.displayName,
    status: row.status,
    sellerName: row.sellerName,
    sellerAddress: row.sellerAddress,
    sellerVatId: row.sellerVatId,
    bankIban: row.bankIban,
    bankName: row.bankName,
    bankAccountName: row.bankAccountName,
    entranceInstructions: row.entranceInstructions,
    cashInstructions: row.cashInstructions,
    billingProvider,
  }
}

export async function ensureMerchantForUser(
  userId: string,
): Promise<{ ok: true; merchant: MerchantRecord } | { ok: false; error: string }> {
  const gate = await assertMayCollect(userId)
  if (!gate.ok) return gate

  const existing = await getMerchantByUserId(userId)
  if (existing) return { ok: true, merchant: existing }

  const id = newId('merch')
  await db.insert(sfPayMerchants).values({
    id,
    userId: userId.trim(),
    displayName: '',
    status: 'draft',
  })
  const merchant = await getMerchantByUserId(userId)
  if (!merchant) return { ok: false, error: 'Could not create merchant' }
  return { ok: true, merchant }
}

export async function updateMerchantProfile(
  userId: string,
  patch: Partial<
    Pick<
      MerchantRecord,
      | 'displayName'
      | 'status'
      | 'sellerName'
      | 'sellerAddress'
      | 'sellerVatId'
      | 'bankIban'
      | 'bankName'
      | 'bankAccountName'
      | 'entranceInstructions'
      | 'cashInstructions'
      | 'billingProvider'
    >
  >,
): Promise<{ ok: true; merchant: MerchantRecord } | { ok: false; error: string }> {
  const ensured = await ensureMerchantForUser(userId)
  if (!ensured.ok) return ensured

  const nextStatus =
    patch.status === 'active' || patch.status === 'suspended' || patch.status === 'draft'
      ? patch.status
      : ensured.merchant.status

  await db
    .update(sfPayMerchants)
    .set({
      displayName: patch.displayName ?? ensured.merchant.displayName,
      status: nextStatus,
      sellerName: patch.sellerName ?? ensured.merchant.sellerName,
      sellerAddress: patch.sellerAddress ?? ensured.merchant.sellerAddress,
      sellerVatId: patch.sellerVatId ?? ensured.merchant.sellerVatId,
      bankIban: patch.bankIban ?? ensured.merchant.bankIban,
      bankName: patch.bankName ?? ensured.merchant.bankName,
      bankAccountName: patch.bankAccountName ?? ensured.merchant.bankAccountName,
      entranceInstructions:
        patch.entranceInstructions ?? ensured.merchant.entranceInstructions,
      cashInstructions: patch.cashInstructions ?? ensured.merchant.cashInstructions,
      billingProvider: patch.billingProvider ?? ensured.merchant.billingProvider,
      updatedAt: new Date(),
    })
    .where(eq(sfPayMerchants.id, ensured.merchant.id))

  const merchant = await getMerchantById(ensured.merchant.id)
  if (!merchant) return { ok: false, error: 'Reload failed' }
  return { ok: true, merchant }
}

export async function listMerchantCredentialsPublic(
  merchantId: string,
): Promise<CredentialPublic[]> {
  try {
    const rows = await db
      .select()
      .from(sfPayMerchantCredentials)
      .where(eq(sfPayMerchantCredentials.merchantId, merchantId))
    return rows.map((r) => {
      let masked = '—'
      if (r.secretCipher) {
        try {
          masked = maskSecret(decryptSecret(r.secretCipher))
        } catch {
          masked = '••••'
        }
      }
      return {
        kind: r.kind,
        hasSecret: Boolean(r.secretCipher),
        masked,
        meta: (r.meta || {}) as Record<string, unknown>,
      }
    })
  } catch {
    return []
  }
}

export async function upsertMerchantCredential(opts: {
  userId: string
  kind: string
  secretPlain?: string
  meta?: Record<string, unknown>
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ensured = await ensureMerchantForUser(opts.userId)
  if (!ensured.ok) return ensured

  const kind = opts.kind.trim().toLowerCase()
  if (!kind) return { ok: false, error: 'Missing credential kind' }

  const existing = await db
    .select()
    .from(sfPayMerchantCredentials)
    .where(
      and(
        eq(sfPayMerchantCredentials.merchantId, ensured.merchant.id),
        eq(sfPayMerchantCredentials.kind, kind),
      ),
    )
    .limit(1)

  const secretCipher =
    opts.secretPlain && opts.secretPlain.trim()
      ? encryptSecret(opts.secretPlain.trim())
      : existing[0]?.secretCipher || ''

  if (!secretCipher && !existing[0]) {
    return { ok: false, error: 'Secret required' }
  }

  if (existing[0]) {
    await db
      .update(sfPayMerchantCredentials)
      .set({
        secretCipher: secretCipher || existing[0].secretCipher,
        meta: opts.meta ?? existing[0].meta ?? {},
        updatedAt: new Date(),
      })
      .where(eq(sfPayMerchantCredentials.id, existing[0].id))
  } else {
    await db.insert(sfPayMerchantCredentials).values({
      id: newId('mcred'),
      merchantId: ensured.merchant.id,
      kind,
      secretCipher,
      meta: opts.meta ?? {},
    })
  }
  return { ok: true }
}

/** Decrypt gateway credentials for checkout (server-only). */
export async function loadGatewayCredentials(
  merchantId: string,
  kind: string,
): Promise<GatewayCredentials | null> {
  const rows = await db
    .select()
    .from(sfPayMerchantCredentials)
    .where(
      and(
        eq(sfPayMerchantCredentials.merchantId, merchantId),
        eq(sfPayMerchantCredentials.kind, kind),
      ),
    )
    .limit(1)
  const row = rows[0]
  if (!row?.secretCipher) return null
  try {
    const secret = decryptSecret(row.secretCipher)
    const meta = (row.meta || {}) as Record<string, string>
    return {
      secret,
      publicId: meta.payeeEmail || meta.publicId || undefined,
      apiBase: meta.apiBase || undefined,
      extra: meta,
    }
  } catch {
    return null
  }
}

export async function loadBillingCredentials(
  merchantId: string,
  kind: BillingProviderKind,
): Promise<{ apiKey: string; extra?: Record<string, string> } | null> {
  if (kind === 'noop') return null
  const rows = await db
    .select()
    .from(sfPayMerchantCredentials)
    .where(
      and(
        eq(sfPayMerchantCredentials.merchantId, merchantId),
        eq(sfPayMerchantCredentials.kind, kind),
      ),
    )
    .limit(1)
  const row = rows[0]
  if (!row?.secretCipher) return null
  try {
    return {
      apiKey: decryptSecret(row.secretCipher),
      extra: (row.meta || {}) as Record<string, string>,
    }
  } catch {
    return null
  }
}
