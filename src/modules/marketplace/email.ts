/**
 * product:marketplace → Email Manager emits (emitEmailTrigger only).
 * A send failure must not roll back the inquiry / offer row.
 */

import 'server-only'

import { eq } from 'drizzle-orm'

import { db, sfUsers } from '@/core/db'

import {
  MARKETPLACE_INQUIRY_CREATED_TRIGGER,
  MARKETPLACE_OFFER_ACCEPTED_TRIGGER,
  MARKETPLACE_OFFER_RECEIVED_TRIGGER,
} from './triggers'

export type MarketplaceEmailPayload = {
  listingId: string
  listingTitle: string
  inquiryId: string
  buyerUserId: string
  sellerUserId: string
  sellerEmail: string
  buyerEmail: string
  amountMinor?: number
  listingUrl: string
}

async function resolveUserEmail(userId: string): Promise<string> {
  const id = String(userId ?? '').trim()
  if (!id) return ''
  try {
    const rows = await db
      .select({ email: sfUsers.email })
      .from(sfUsers)
      .where(eq(sfUsers.id, id))
      .limit(1)
    return (rows[0]?.email || '').trim().toLowerCase()
  } catch {
    return ''
  }
}

export async function buildMarketplaceEmailPayload(input: {
  listingId: string
  listingTitle: string
  inquiryId: string
  buyerUserId: string
  sellerUserId: string
  amountMinor?: number
  listingUrl?: string
}): Promise<MarketplaceEmailPayload> {
  const [sellerEmail, buyerEmail] = await Promise.all([
    resolveUserEmail(input.sellerUserId),
    resolveUserEmail(input.buyerUserId),
  ])
  return {
    listingId: input.listingId,
    listingTitle: input.listingTitle,
    inquiryId: input.inquiryId,
    buyerUserId: input.buyerUserId,
    sellerUserId: input.sellerUserId,
    sellerEmail,
    buyerEmail,
    amountMinor: input.amountMinor,
    listingUrl: input.listingUrl || `/marketplace/${input.listingId}`,
  }
}

async function emitIfEnabled(
  triggerKey: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { emitEmailTrigger, isEmailManagerEnabled } = await import(
    '@/modules/email-manager/api.server'
  )
  if (!(await isEmailManagerEnabled())) return
  await emitEmailTrigger({ triggerKey, payload })
}

/** Soft-fail wrapper — row writes must not depend on mail. */
export async function emitMarketplaceEmail(
  triggerKey: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await emitIfEnabled(triggerKey, payload)
  } catch (error) {
    console.error('[marketplace] email emit failed', triggerKey, error)
  }
}

export async function emitMarketplaceInquiryCreated(
  payload: MarketplaceEmailPayload,
): Promise<void> {
  await emitMarketplaceEmail(MARKETPLACE_INQUIRY_CREATED_TRIGGER, { ...payload })
}

export async function emitMarketplaceOfferReceived(
  payload: MarketplaceEmailPayload,
): Promise<void> {
  await emitMarketplaceEmail(MARKETPLACE_OFFER_RECEIVED_TRIGGER, { ...payload })
}

export async function emitMarketplaceOfferAccepted(
  payload: MarketplaceEmailPayload,
): Promise<void> {
  await emitMarketplaceEmail(MARKETPLACE_OFFER_ACCEPTED_TRIGGER, { ...payload })
}
