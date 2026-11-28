/**
 * Pure marketplace inquiry / offer rules.
 * Store and actions call these; unit tests hit this module without DB.
 * No db import. Accept never produces a Payments cart line.
 */

export const OFFER_STATUSES = ['open', 'accepted', 'declined'] as const
export type OfferStatus = (typeof OFFER_STATUSES)[number]

export const MESSAGE_KINDS = ['text', 'availability'] as const
export type MessageKind = (typeof MESSAGE_KINDS)[number]

export type MarketplaceInquiryRecord = {
  id: string
  listingId: string
  buyerUserId: string
  createdAt: Date
  updatedAt: Date
}

export type MarketplaceMessageRecord = {
  id: string
  inquiryId: string
  authorUserId: string
  body: string
  kind: MessageKind
  createdAt: Date
  updatedAt: Date
}

export type MarketplaceOfferRecord = {
  id: string
  inquiryId: string
  amountMinor: number
  status: OfferStatus
  createdAt: Date
  updatedAt: Date
}

/** Context for participant checks (inquiry buyer + listing seller). */
export type InquiryParticipants = {
  buyerUserId: string
  sellerUserId: string
}

export type OfferOpenDecision =
  | {
      ok: true
      offer: MarketplaceOfferRecord
      /** Accept / open never charge — always absent. */
      cartLine?: undefined
    }
  | { ok: false; error: string }

export type OfferRespondDecision =
  | {
      ok: true
      offer: MarketplaceOfferRecord
      /** When accept marks the listing sold in the same transaction. */
      listingSold?: { soldToUserId: string; status: 'sold' }
      /** Accept does not write a Payments row. */
      cartLine?: undefined
    }
  | { ok: false; error: string }

export type MessagePostDecision =
  | { ok: true; message: MarketplaceMessageRecord }
  | { ok: false; error: string }

export function isOfferStatus(value: unknown): value is OfferStatus {
  return (
    typeof value === 'string' && (OFFER_STATUSES as readonly string[]).includes(value)
  )
}

export function isMessageKind(value: unknown): value is MessageKind {
  return (
    typeof value === 'string' && (MESSAGE_KINDS as readonly string[]).includes(value)
  )
}

function asTrimmed(raw: unknown): string {
  return String(raw ?? '').trim()
}

/** Buyer or seller on that inquiry may post; anyone else is refused. */
export function isInquiryParticipant(
  actorUserId: string,
  participants: InquiryParticipants,
): boolean {
  const uid = asTrimmed(actorUserId)
  if (!uid) return false
  return uid === asTrimmed(participants.buyerUserId) || uid === asTrimmed(participants.sellerUserId)
}

/**
 * Post a text or availability message. Non-participants are refused.
 */
export function decideMarketplacePostMessage(
  inquiry: MarketplaceInquiryRecord,
  participants: InquiryParticipants,
  input: { authorUserId: string; body?: unknown; kind?: unknown },
  opts?: { now?: Date; newId?: () => string },
): MessagePostDecision {
  const authorUserId = asTrimmed(input.authorUserId)
  if (!authorUserId) return { ok: false, error: 'Sign in to message.' }
  if (!isInquiryParticipant(authorUserId, participants)) {
    return { ok: false, error: 'Only the buyer or seller on this inquiry may post.' }
  }

  const kindRaw = asTrimmed(input.kind || 'text').toLowerCase()
  if (!isMessageKind(kindRaw)) {
    return { ok: false, error: 'Message kind must be text or availability.' }
  }

  let body = asTrimmed(input.body).slice(0, 4000)
  if (kindRaw === 'availability') {
    body = body || 'Is this still available?'
  } else if (!body) {
    return { ok: false, error: 'Message body is required.' }
  }

  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  return {
    ok: true,
    message: {
      id: newId(),
      inquiryId: inquiry.id,
      authorUserId,
      body,
      kind: kindRaw,
      createdAt: now,
      updatedAt: now,
    },
  }
}

/**
 * “Ask if available” — one availability message from the buyer.
 */
export function decideMarketplaceAskAvailable(
  inquiry: MarketplaceInquiryRecord,
  participants: InquiryParticipants,
  buyerUserId: string,
  opts?: { now?: Date; newId?: () => string },
): MessagePostDecision {
  return decideMarketplacePostMessage(
    inquiry,
    participants,
    {
      authorUserId: buyerUserId,
      kind: 'availability',
      body: 'Is this still available?',
    },
    opts,
  )
}

/**
 * Buyer on that inquiry may open an offer (integer ≥ 0) when offers are enabled.
 * A second open offer is refused. Result never includes a cart line.
 */
export function decideMarketplaceOpenOffer(
  inquiry: MarketplaceInquiryRecord,
  participants: InquiryParticipants,
  input: { buyerUserId: string; amountMinor: unknown },
  gates: { offersEnabled: boolean; openOffer: MarketplaceOfferRecord | null },
  opts?: { now?: Date; newId?: () => string },
): OfferOpenDecision {
  if (!gates.offersEnabled) {
    return { ok: false, error: 'Offers are disabled.' }
  }

  const buyerUserId = asTrimmed(input.buyerUserId)
  if (!buyerUserId) return { ok: false, error: 'Sign in to make an offer.' }
  if (buyerUserId !== asTrimmed(participants.buyerUserId)) {
    return { ok: false, error: 'Only the buyer on this inquiry may open an offer.' }
  }
  if (!isInquiryParticipant(buyerUserId, participants)) {
    return { ok: false, error: 'Only the buyer or seller on this inquiry may post.' }
  }

  if (gates.openOffer && gates.openOffer.status === 'open') {
    return { ok: false, error: 'This inquiry already has an open offer.' }
  }

  const n =
    typeof input.amountMinor === 'number'
      ? input.amountMinor
      : Number(String(input.amountMinor ?? '').trim())
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return { ok: false, error: 'Offer amount must be a whole number of minor units.' }
  }
  if (n < 0) {
    return { ok: false, error: 'Offer amount must be an integer ≥ 0.' }
  }

  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  return {
    ok: true,
    offer: {
      id: newId(),
      inquiryId: inquiry.id,
      amountMinor: n,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    },
  }
}

/**
 * Seller may accept or decline the open offer.
 * Accept does not write a Payments row (no cartLine). Accept may mark the
 * listing sold to the buyer in the same transaction.
 */
export function decideMarketplaceRespondOffer(
  inquiry: MarketplaceInquiryRecord,
  participants: InquiryParticipants,
  openOffer: MarketplaceOfferRecord | null,
  input: { sellerUserId: string; response: 'accept' | 'decline' },
  opts?: { now?: Date; markListingSold?: boolean },
): OfferRespondDecision {
  const sellerUserId = asTrimmed(input.sellerUserId)
  if (!sellerUserId) return { ok: false, error: 'Sign in to respond to an offer.' }
  if (sellerUserId !== asTrimmed(participants.sellerUserId)) {
    return { ok: false, error: 'Only the seller may accept or decline an offer.' }
  }
  if (!isInquiryParticipant(sellerUserId, participants)) {
    return { ok: false, error: 'Only the buyer or seller on this inquiry may post.' }
  }

  if (!openOffer || openOffer.status !== 'open') {
    return { ok: false, error: 'There is no open offer on this inquiry.' }
  }
  if (openOffer.inquiryId !== inquiry.id) {
    return { ok: false, error: 'Offer does not belong to this inquiry.' }
  }

  const now = opts?.now ?? new Date()
  const nextStatus: OfferStatus = input.response === 'accept' ? 'accepted' : 'declined'
  const offer: MarketplaceOfferRecord = {
    ...openOffer,
    status: nextStatus,
    updatedAt: now,
  }

  if (input.response === 'accept' && opts?.markListingSold !== false) {
    return {
      ok: true,
      offer,
      listingSold: {
        soldToUserId: asTrimmed(participants.buyerUserId),
        status: 'sold',
      },
    }
  }

  return { ok: true, offer }
}
