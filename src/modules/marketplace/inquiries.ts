/**
 * Marketplace inquiries, messages, and offers.
 * Pure rules stay in offer-rules.ts; mail soft-fails after the row write.
 */

import 'server-only'

import { and, asc, desc, eq } from 'drizzle-orm'

import { db } from '@/core/db'

import {
  buildMarketplaceEmailPayload,
  emitMarketplaceInquiryCreated,
  emitMarketplaceOfferAccepted,
  emitMarketplaceOfferReceived,
} from './email'
import { getMarketplaceListing } from './listings'
import {
  decideMarketplaceAskAvailable,
  decideMarketplaceOpenOffer,
  decideMarketplacePostMessage,
  decideMarketplaceRespondOffer,
  isMessageKind,
  isOfferStatus,
  type MarketplaceInquiryRecord,
  type MarketplaceMessageRecord,
  type MarketplaceOfferRecord,
} from './offer-rules'
import {
  sfMarketplaceInquiries,
  sfMarketplaceListings,
  sfMarketplaceMessages,
  sfMarketplaceOffers,
} from './schema'
import { loadMarketplaceModuleSettings } from './settings'

function tableMissingMessage(error: unknown): string | null {
  const msg = error instanceof Error ? error.message : String(error)
  if (
    msg.includes('sf_marketplace_inquiries') ||
    msg.includes('sf_marketplace_messages') ||
    msg.includes('sf_marketplace_offers') ||
    /does not exist|relation/i.test(msg)
  ) {
    return 'Marketplace inquiry tables missing — run npm run db:migrate.'
  }
  return null
}

function mapInquiryRow(
  row: typeof sfMarketplaceInquiries.$inferSelect,
): MarketplaceInquiryRecord {
  return {
    id: row.id,
    listingId: (row.listingId || '').trim(),
    buyerUserId: (row.buyerUserId || '').trim(),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapMessageRow(
  row: typeof sfMarketplaceMessages.$inferSelect,
): MarketplaceMessageRecord {
  const kind = isMessageKind(row.kind) ? row.kind : 'text'
  return {
    id: row.id,
    inquiryId: (row.inquiryId || '').trim(),
    authorUserId: (row.authorUserId || '').trim(),
    body: (row.body || '').trim(),
    kind,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapOfferRow(
  row: typeof sfMarketplaceOffers.$inferSelect,
): MarketplaceOfferRecord {
  const status = isOfferStatus(row.status) ? row.status : 'open'
  return {
    id: row.id,
    inquiryId: (row.inquiryId || '').trim(),
    amountMinor:
      typeof row.amountMinor === 'number' && Number.isFinite(row.amountMinor)
        ? Math.trunc(row.amountMinor)
        : 0,
    status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function findMarketplaceInquiry(
  listingId: string,
  buyerUserId: string,
): Promise<MarketplaceInquiryRecord | null> {
  const lid = String(listingId ?? '').trim()
  const uid = String(buyerUserId ?? '').trim()
  if (!lid || !uid) return null
  try {
    const rows = await db
      .select()
      .from(sfMarketplaceInquiries)
      .where(
        and(
          eq(sfMarketplaceInquiries.listingId, lid),
          eq(sfMarketplaceInquiries.buyerUserId, uid),
        ),
      )
      .limit(1)
    const row = rows[0]
    return row ? mapInquiryRow(row) : null
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return null
    throw error
  }
}

export async function getMarketplaceInquiryById(
  inquiryId: string,
): Promise<MarketplaceInquiryRecord | null> {
  const id = String(inquiryId ?? '').trim()
  if (!id) return null
  try {
    const rows = await db
      .select()
      .from(sfMarketplaceInquiries)
      .where(eq(sfMarketplaceInquiries.id, id))
      .limit(1)
    const row = rows[0]
    return row ? mapInquiryRow(row) : null
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return null
    throw error
  }
}

/** Create or return the unique (listing, buyer) inquiry. */
export async function ensureMarketplaceInquiry(
  listingId: string,
  buyerUserId: string,
): Promise<{ inquiry: MarketplaceInquiryRecord; created: boolean } | { error: string }> {
  const lid = String(listingId ?? '').trim()
  const uid = String(buyerUserId ?? '').trim()
  if (!uid) return { error: 'Sign in to inquire.' }
  if (!lid) return { error: 'Missing listing id.' }

  const listing = await getMarketplaceListing(lid)
  if (!listing) return { error: 'Listing not found.' }
  if (listing.sellerUserId === uid) {
    return { error: 'You cannot inquire on your own listing.' }
  }

  const existing = await findMarketplaceInquiry(lid, uid)
  if (existing) return { inquiry: existing, created: false }

  const now = new Date()
  const id = crypto.randomUUID()
  try {
    const inserted = await db
      .insert(sfMarketplaceInquiries)
      .values({
        id,
        listingId: lid,
        buyerUserId: uid,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    const row = inserted[0]
    if (!row) return { error: 'Could not create inquiry.' }
    return { inquiry: mapInquiryRow(row), created: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const missing = tableMissingMessage(error)
    if (missing) return { error: missing }
    if (/unique|duplicate/i.test(msg)) {
      const again = await findMarketplaceInquiry(lid, uid)
      if (again) return { inquiry: again, created: false }
    }
    throw error
  }
}

export async function findOpenMarketplaceOffer(
  inquiryId: string,
): Promise<MarketplaceOfferRecord | null> {
  const id = String(inquiryId ?? '').trim()
  if (!id) return null
  try {
    const rows = await db
      .select()
      .from(sfMarketplaceOffers)
      .where(
        and(
          eq(sfMarketplaceOffers.inquiryId, id),
          eq(sfMarketplaceOffers.status, 'open'),
        ),
      )
      .orderBy(desc(sfMarketplaceOffers.createdAt))
      .limit(1)
    const row = rows[0]
    return row ? mapOfferRow(row) : null
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return null
    throw error
  }
}

export async function listMarketplaceMessages(
  inquiryId: string,
): Promise<MarketplaceMessageRecord[]> {
  const id = String(inquiryId ?? '').trim()
  if (!id) return []
  try {
    const rows = await db
      .select()
      .from(sfMarketplaceMessages)
      .where(eq(sfMarketplaceMessages.inquiryId, id))
      .orderBy(asc(sfMarketplaceMessages.createdAt))
      .limit(500)
    return rows.map(mapMessageRow)
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return []
    throw error
  }
}

export type MarketplaceInquiryThread = {
  inquiry: MarketplaceInquiryRecord
  messages: MarketplaceMessageRecord[]
  openOffer: MarketplaceOfferRecord | null
  offers: MarketplaceOfferRecord[]
}

export async function loadMarketplaceInquiryThread(
  inquiryId: string,
): Promise<MarketplaceInquiryThread | null> {
  const inquiry = await getMarketplaceInquiryById(inquiryId)
  if (!inquiry) return null
  let offerRows: (typeof sfMarketplaceOffers.$inferSelect)[] = []
  try {
    offerRows = await db
      .select()
      .from(sfMarketplaceOffers)
      .where(eq(sfMarketplaceOffers.inquiryId, inquiry.id))
      .orderBy(desc(sfMarketplaceOffers.createdAt))
      .limit(50)
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (!missing) throw error
  }
  const [messages, openOffer] = await Promise.all([
    listMarketplaceMessages(inquiry.id),
    findOpenMarketplaceOffer(inquiry.id),
  ])
  return {
    inquiry,
    messages,
    openOffer,
    offers: offerRows.map(mapOfferRow),
  }
}

/** Inquiries for a listing (seller view). */
export async function listMarketplaceInquiriesForListing(
  listingId: string,
): Promise<MarketplaceInquiryThread[]> {
  const lid = String(listingId ?? '').trim()
  if (!lid) return []
  try {
    const rows = await db
      .select()
      .from(sfMarketplaceInquiries)
      .where(eq(sfMarketplaceInquiries.listingId, lid))
      .orderBy(desc(sfMarketplaceInquiries.updatedAt))
      .limit(100)
    const threads: MarketplaceInquiryThread[] = []
    for (const row of rows) {
      const thread = await loadMarketplaceInquiryThread(row.id)
      if (thread) threads.push(thread)
    }
    return threads
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return []
    throw error
  }
}

/** Buyer’s inquiry on a listing, if any. */
export async function loadMarketplaceBuyerThread(
  listingId: string,
  buyerUserId: string,
): Promise<MarketplaceInquiryThread | null> {
  const inquiry = await findMarketplaceInquiry(listingId, buyerUserId)
  if (!inquiry) return null
  return loadMarketplaceInquiryThread(inquiry.id)
}

async function emailPayloadFor(
  listing: { id: string; title: string; sellerUserId: string },
  inquiry: MarketplaceInquiryRecord,
  amountMinor?: number,
) {
  return buildMarketplaceEmailPayload({
    listingId: listing.id,
    listingTitle: listing.title,
    inquiryId: inquiry.id,
    buyerUserId: inquiry.buyerUserId,
    sellerUserId: listing.sellerUserId,
    amountMinor,
    listingUrl: `/marketplace/${listing.id}`,
  })
}

/** “Ask if available” — ensures inquiry + one availability message. */
export async function askMarketplaceListingAvailable(
  listingId: string,
  buyerUserId: string,
): Promise<
  | { inquiry: MarketplaceInquiryRecord; message: MarketplaceMessageRecord }
  | { error: string }
> {
  const ensured = await ensureMarketplaceInquiry(listingId, buyerUserId)
  if ('error' in ensured) return ensured

  const listing = await getMarketplaceListing(listingId)
  if (!listing) return { error: 'Listing not found.' }

  const participants = {
    buyerUserId: ensured.inquiry.buyerUserId,
    sellerUserId: listing.sellerUserId,
  }
  const decision = decideMarketplaceAskAvailable(
    ensured.inquiry,
    participants,
    buyerUserId,
  )
  if (!decision.ok) return { error: decision.error }

  try {
    await db.insert(sfMarketplaceMessages).values({
      id: decision.message.id,
      inquiryId: decision.message.inquiryId,
      authorUserId: decision.message.authorUserId,
      body: decision.message.body,
      kind: decision.message.kind,
      createdAt: decision.message.createdAt,
      updatedAt: decision.message.updatedAt,
    })
    await db
      .update(sfMarketplaceInquiries)
      .set({ updatedAt: new Date() })
      .where(eq(sfMarketplaceInquiries.id, ensured.inquiry.id))
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return { error: missing }
    throw error
  }

  if (ensured.created) {
    const payload = await emailPayloadFor(listing, ensured.inquiry)
    void emitMarketplaceInquiryCreated(payload)
  }

  return { inquiry: ensured.inquiry, message: decision.message }
}

/** Post a text message on an existing inquiry (buyer or seller). */
export async function postMarketplaceInquiryMessage(
  inquiryId: string,
  authorUserId: string,
  body: string,
): Promise<{ message: MarketplaceMessageRecord } | { error: string }> {
  const inquiry = await getMarketplaceInquiryById(inquiryId)
  if (!inquiry) return { error: 'Inquiry not found.' }
  const listing = await getMarketplaceListing(inquiry.listingId)
  if (!listing) return { error: 'Listing not found.' }

  const participants = {
    buyerUserId: inquiry.buyerUserId,
    sellerUserId: listing.sellerUserId,
  }
  const decision = decideMarketplacePostMessage(inquiry, participants, {
    authorUserId,
    body,
    kind: 'text',
  })
  if (!decision.ok) return { error: decision.error }

  try {
    await db.insert(sfMarketplaceMessages).values({
      id: decision.message.id,
      inquiryId: decision.message.inquiryId,
      authorUserId: decision.message.authorUserId,
      body: decision.message.body,
      kind: decision.message.kind,
      createdAt: decision.message.createdAt,
      updatedAt: decision.message.updatedAt,
    })
    await db
      .update(sfMarketplaceInquiries)
      .set({ updatedAt: new Date() })
      .where(eq(sfMarketplaceInquiries.id, inquiry.id))
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return { error: missing }
    throw error
  }

  return { message: decision.message }
}

/** Buyer opens an offer on their inquiry for a listing. */
export async function openMarketplaceOffer(
  listingId: string,
  buyerUserId: string,
  amountMinor: unknown,
): Promise<{ inquiry: MarketplaceInquiryRecord; offer: MarketplaceOfferRecord } | { error: string }> {
  const ensured = await ensureMarketplaceInquiry(listingId, buyerUserId)
  if ('error' in ensured) return ensured

  const listing = await getMarketplaceListing(listingId)
  if (!listing) return { error: 'Listing not found.' }

  const { settings } = await loadMarketplaceModuleSettings()
  const openOffer = await findOpenMarketplaceOffer(ensured.inquiry.id)
  const participants = {
    buyerUserId: ensured.inquiry.buyerUserId,
    sellerUserId: listing.sellerUserId,
  }
  const decision = decideMarketplaceOpenOffer(
    ensured.inquiry,
    participants,
    { buyerUserId, amountMinor },
    { offersEnabled: settings.offersEnabled, openOffer },
  )
  if (!decision.ok) return { error: decision.error }

  try {
    await db.insert(sfMarketplaceOffers).values({
      id: decision.offer.id,
      inquiryId: decision.offer.inquiryId,
      amountMinor: decision.offer.amountMinor,
      status: decision.offer.status,
      createdAt: decision.offer.createdAt,
      updatedAt: decision.offer.updatedAt,
    })
    await db
      .update(sfMarketplaceInquiries)
      .set({ updatedAt: new Date() })
      .where(eq(sfMarketplaceInquiries.id, ensured.inquiry.id))
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return { error: missing }
    throw error
  }

  if (ensured.created) {
    const createdPayload = await emailPayloadFor(listing, ensured.inquiry)
    void emitMarketplaceInquiryCreated(createdPayload)
  }
  const payload = await emailPayloadFor(
    listing,
    ensured.inquiry,
    decision.offer.amountMinor,
  )
  void emitMarketplaceOfferReceived(payload)

  return { inquiry: ensured.inquiry, offer: decision.offer }
}

/** Seller accepts or declines the open offer. Accept may mark listing sold. */
export async function respondMarketplaceOffer(
  inquiryId: string,
  sellerUserId: string,
  response: 'accept' | 'decline',
): Promise<
  | {
      offer: MarketplaceOfferRecord
      listingSold?: { soldToUserId: string; status: 'sold' }
    }
  | { error: string }
> {
  const inquiry = await getMarketplaceInquiryById(inquiryId)
  if (!inquiry) return { error: 'Inquiry not found.' }
  const listing = await getMarketplaceListing(inquiry.listingId)
  if (!listing) return { error: 'Listing not found.' }

  const openOffer = await findOpenMarketplaceOffer(inquiry.id)
  const participants = {
    buyerUserId: inquiry.buyerUserId,
    sellerUserId: listing.sellerUserId,
  }
  const decision = decideMarketplaceRespondOffer(
    inquiry,
    participants,
    openOffer,
    { sellerUserId, response },
  )
  if (!decision.ok) return { error: decision.error }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(sfMarketplaceOffers)
        .set({
          status: decision.offer.status,
          updatedAt: decision.offer.updatedAt,
        })
        .where(eq(sfMarketplaceOffers.id, decision.offer.id))

      if (decision.listingSold) {
        await tx
          .update(sfMarketplaceListings)
          .set({
            status: decision.listingSold.status,
            soldToUserId: decision.listingSold.soldToUserId,
            updatedAt: new Date(),
          })
          .where(eq(sfMarketplaceListings.id, listing.id))
      }

      await tx
        .update(sfMarketplaceInquiries)
        .set({ updatedAt: new Date() })
        .where(eq(sfMarketplaceInquiries.id, inquiry.id))
    })
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return { error: missing }
    throw error
  }

  if (response === 'accept') {
    const payload = await emailPayloadFor(
      listing,
      inquiry,
      decision.offer.amountMinor,
    )
    void emitMarketplaceOfferAccepted(payload)
  }

  return {
    offer: decision.offer,
    listingSold: decision.listingSold,
  }
}
