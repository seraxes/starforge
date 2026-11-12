/**
 * Pure paced-broadcast helpers (dedupe, cap, batch math, pace clamps) — safe for unit tests.
 */

import { splitEmailList } from './audience'
import {
  DEFAULT_EMAIL_MANAGER_MODULE_SETTINGS,
  EMAIL_BROADCAST_BATCH_MAX,
  EMAIL_BROADCAST_BATCH_MIN,
  EMAIL_BROADCAST_GAP_MAX,
  EMAIL_BROADCAST_GAP_MIN,
  EMAIL_BROADCAST_RECIPIENT_CAP,
  type EmailBroadcastRecipientInput,
  type EmailManagerModuleSettings,
} from './types'

export function clampBroadcastBatchSize(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return DEFAULT_EMAIL_MANAGER_MODULE_SETTINGS.broadcastBatchSize
  return Math.min(
    EMAIL_BROADCAST_BATCH_MAX,
    Math.max(EMAIL_BROADCAST_BATCH_MIN, Math.floor(n)),
  )
}

export function clampBroadcastGapMinutes(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return DEFAULT_EMAIL_MANAGER_MODULE_SETTINGS.broadcastGapMinutes
  return Math.min(
    EMAIL_BROADCAST_GAP_MAX,
    Math.max(EMAIL_BROADCAST_GAP_MIN, Math.floor(n)),
  )
}

export function normalizeEmailManagerModuleSettings(
  raw: unknown,
): EmailManagerModuleSettings {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  return {
    broadcastBatchSize: clampBroadcastBatchSize(obj.broadcastBatchSize),
    broadcastGapMinutes: clampBroadcastGapMinutes(obj.broadcastGapMinutes),
  }
}

export type NormalizedBroadcastRecipient = {
  email: string
  payload: Record<string, unknown>
}

/**
 * Lowercase + dedupe by address. First payload wins for a repeated email.
 * Invalid addresses are dropped.
 */
export function normalizeBroadcastRecipients(
  recipients: EmailBroadcastRecipientInput[],
): NormalizedBroadcastRecipient[] {
  const out: NormalizedBroadcastRecipient[] = []
  const seen = new Set<string>()
  for (const row of recipients || []) {
    const emails = splitEmailList([String(row?.email ?? '')])
    const email = emails[0]
    if (!email || seen.has(email)) continue
    seen.add(email)
    const payload =
      row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {}
    out.push({ email, payload })
  }
  return out
}

export function applyBroadcastRecipientCap(
  recipients: NormalizedBroadcastRecipient[],
  cap: number = EMAIL_BROADCAST_RECIPIENT_CAP,
): { recipients: NormalizedBroadcastRecipient[]; truncated: boolean } {
  const limit = Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : EMAIL_BROADCAST_RECIPIENT_CAP
  if (recipients.length <= limit) {
    return { recipients, truncated: false }
  }
  return { recipients: recipients.slice(0, limit), truncated: true }
}

/** How many drain slices are needed for `total` recipients at `batchSize`. */
export function broadcastSliceCount(total: number, batchSize: number): number {
  const n = Math.max(0, Math.floor(total))
  const size = Math.max(1, Math.floor(batchSize))
  if (n === 0) return 0
  return Math.ceil(n / size)
}

export const EMAIL_BROADCAST_DRAIN_JOB = 'email.broadcast-drain' as const
