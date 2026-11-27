/**
 * Pure marketplace save rules.
 * Store and actions call these; unit tests hit this module without DB.
 *
 * Saving a listing the public predicate rejects is refused.
 * A second save of the same (userId, listingId) pair is a no-op success.
 */

export type MarketplaceSaveRecord = {
  id: string
  userId: string
  listingId: string
  createdAt: Date
  updatedAt: Date
}

export type MarketplaceSaveInput = {
  userId: string
  listingId: string
}

export type MarketplaceSaveDecision =
  | { ok: true; write: 'insert'; save: MarketplaceSaveRecord }
  | { ok: true; write: 'noop'; save: MarketplaceSaveRecord }
  | { ok: false; error: string }

export type MarketplaceUnsaveDecision =
  | { ok: true; removed: MarketplaceSaveRecord }
  | { ok: false; error: string }

/**
 * Save when the listing matches the public browse predicate.
 * Unique pair: existing row → no-op success (does not insert a second row).
 */
export function decideMarketplaceSave(
  current: MarketplaceSaveRecord | null,
  input: MarketplaceSaveInput,
  gates: { isPublic: boolean },
  opts?: { now?: Date; newId?: () => string },
): MarketplaceSaveDecision {
  const userId = String(input.userId ?? '').trim()
  const listingId = String(input.listingId ?? '').trim()
  if (!userId) return { ok: false, error: 'Sign in to save a listing.' }
  if (!listingId) return { ok: false, error: 'Missing listing id.' }
  if (!gates.isPublic) {
    return { ok: false, error: 'Only public listings can be saved.' }
  }

  if (current && current.userId === userId && current.listingId === listingId) {
    return { ok: true, write: 'noop', save: current }
  }

  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  return {
    ok: true,
    write: 'insert',
    save: {
      id: newId(),
      userId,
      listingId,
      createdAt: now,
      updatedAt: now,
    },
  }
}

/** Unsave an existing row. Missing pair is refused. */
export function decideMarketplaceUnsave(
  current: MarketplaceSaveRecord | null,
  userId: string,
  listingId: string,
): MarketplaceUnsaveDecision {
  const uid = String(userId ?? '').trim()
  const lid = String(listingId ?? '').trim()
  if (!uid) return { ok: false, error: 'Sign in to unsave a listing.' }
  if (!lid) return { ok: false, error: 'Missing listing id.' }
  if (!current || current.userId !== uid || current.listingId !== lid) {
    return { ok: false, error: 'Listing is not saved.' }
  }
  return { ok: true, removed: current }
}
